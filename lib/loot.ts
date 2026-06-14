import fs from 'fs';
import path from 'path';

type LootTable = {
  coins?: Partial<Record<'cp' | 'sp' | 'gp' | 'pp', string>>;
  items?: Array<{ id: string; weight: number; qty?: string }>;
};

type LootResult = {
  coins: Partial<Record<'cp' | 'sp' | 'gp' | 'pp', number>>;
  items: Array<{ id: string; quantity: number }>;
};

let cachedTables: Record<string, LootTable> | null = null;

function rollDice(notation: string | undefined): number {
  if (!notation) return 0;
  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!match) return Number(notation) || 0;
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const mod = match[3] ? parseInt(match[3], 10) : 0;
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total + mod;
}

function ensureTables(force = false) {
  const needsRefresh = force || !cachedTables || Object.keys(cachedTables).length === 0;
  if (!needsRefresh) return;
  const dir = path.join(process.cwd(), 'data', '5e', 'loot');
  const tables: Record<string, LootTable> = {};
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf8');
        const parsed = JSON.parse(raw) as LootTable;
        const key = file.replace(/\.json$/i, '').toLowerCase();
        tables[key] = parsed;
      } catch (err) {
        console.error('Failed to load loot table', file, err);
      }
    }
  }
  cachedTables = tables;
}

export function rollLoot(tableName: string): LootResult | null {
  ensureTables();
  const key = tableName.toLowerCase();
  let table = cachedTables?.[key] || cachedTables?.[tableName];
  if (!table) {
    ensureTables(true);
    table = cachedTables?.[key] || cachedTables?.[tableName];
  }
  if (!table) return null;

  const coins: LootResult['coins'] = {};
  if (table.coins) {
    for (const [denom, dice] of Object.entries(table.coins)) {
      coins[denom as keyof typeof coins] = rollDice(dice);
    }
  }

  const items: LootResult['items'] = [];
  if (table.items && table.items.length > 0) {
    const totalWeight = table.items.reduce((acc, item) => acc + (item.weight || 1), 0);
    const pick = Math.random() * totalWeight;
    let running = 0;
    let chosen = table.items[0];
    for (const item of table.items) {
      running += item.weight || 1;
      if (pick <= running) {
        chosen = item;
        break;
      }
    }
    const qty = Math.max(1, rollDice(chosen.qty || '1'));
    items.push({ id: chosen.id, quantity: qty });
  }

  return { coins, items };
}

export function listLootTables(): string[] {
  ensureTables();
  return Object.keys(cachedTables || {});
}
