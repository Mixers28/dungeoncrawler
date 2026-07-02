/**
 * Sprint 3.2 — Save migration helper.
 *
 * Inspects every row in saved_games, runs the raw JSONB through the same
 * Zod schema + hydration backfills the app uses (lib/game/state.ts), and
 * reports per user which fields are missing/stale and what would change.
 *
 * Usage:
 *   npm run db:migrate-saves               # dry-run report (default)
 *   npm run db:migrate-saves -- --apply    # write migrated states back
 *   npm run db:migrate-saves -- --user someone@example.com
 *
 * Exits 1 if any save fails schema validation (incompatible), else 0.
 */
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { savedGames, users } from '../lib/db/schema';
import { gameStateSchema, hydrateState } from '../lib/game/state';

type RowReport = {
  email: string;
  status: 'ok' | 'backfilled' | 'incompatible';
  changedKeys: string[];
  issues: string[];
};

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const userIdx = argv.indexOf('--user');
  const userFilter = userIdx >= 0 ? argv[userIdx + 1] : undefined;
  if (userIdx >= 0 && !userFilter) {
    console.error('--user requires an email argument');
    process.exit(2);
  }
  return { apply, userFilter };
}

/** JSON.stringify with recursively sorted object keys, so key order never counts as a change. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Top-level keys whose value genuinely differs between raw and hydrated. */
function diffKeys(raw: Record<string, unknown>, hydrated: Record<string, unknown>): string[] {
  const keys = Array.from(new Set(Object.keys(raw).concat(Object.keys(hydrated))));
  const changed: string[] = [];
  for (const key of keys) {
    if (stableStringify(raw[key]) !== stableStringify(hydrated[key])) changed.push(key);
  }
  return changed.sort();
}

async function main() {
  const { apply, userFilter } = parseArgs(process.argv.slice(2));

  const rows = await db
    .select({ userId: savedGames.userId, gameState: savedGames.gameState, email: users.email })
    .from(savedGames)
    .innerJoin(users, eq(users.id, savedGames.userId));

  const targets = userFilter ? rows.filter(r => r.email === userFilter) : rows;
  if (userFilter && targets.length === 0) {
    console.error(`No save found for user ${userFilter}`);
    process.exit(2);
  }

  console.log(`${apply ? 'MIGRATING' : 'DRY RUN (pass --apply to write)'} — ${targets.length} save(s)\n`);

  const reports: RowReport[] = [];
  for (const row of targets) {
    const raw = row.gameState as Record<string, unknown>;
    const report: RowReport = { email: row.email, status: 'ok', changedKeys: [], issues: [] };
    reports.push(report);

    // Surface field-level problems even when hydration would reject the save.
    const parsed = gameStateSchema.safeParse(raw);
    if (!parsed.success) {
      report.status = 'incompatible';
      report.issues = parsed.error.issues
        .slice(0, 10)
        .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`);
      continue;
    }

    try {
      const hydrated = await hydrateState(structuredClone(raw));
      report.changedKeys = diffKeys(raw, hydrated as unknown as Record<string, unknown>);
      if (report.changedKeys.length > 0) {
        report.status = 'backfilled';
        if (apply) {
          await db
            .update(savedGames)
            .set({ gameState: hydrated, updatedAt: new Date() })
            .where(eq(savedGames.userId, row.userId));
        }
      }
    } catch (err) {
      report.status = 'incompatible';
      report.issues = [err instanceof Error ? err.message : String(err)];
    }
  }

  for (const r of reports) {
    if (r.status === 'ok') {
      console.log(`✓ ${r.email} — up to date`);
    } else if (r.status === 'backfilled') {
      const verb = apply ? 'migrated' : 'would migrate';
      console.log(`~ ${r.email} — ${verb}: ${r.changedKeys.join(', ')}`);
    } else {
      console.log(`✗ ${r.email} — INCOMPATIBLE (not auto-migratable)`);
      for (const issue of r.issues) console.log(`    ${issue}`);
    }
  }

  const backfilled = reports.filter(r => r.status === 'backfilled').length;
  const incompatible = reports.filter(r => r.status === 'incompatible').length;
  console.log(
    `\nSummary: ${reports.length} checked, ${reports.length - backfilled - incompatible} up to date, ` +
      `${backfilled} ${apply ? 'migrated' : 'need migration'}, ${incompatible} incompatible`
  );

  process.exit(incompatible > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('migrate-saves failed:', err);
  process.exit(2);
});
