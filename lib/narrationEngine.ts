import type { NarrationMode } from './game-schema';
import searchLines from '../data/narration/search.json';
import combatLines from '../data/narration/combat.json';
import roomLines from '../data/narration/room.json';

export interface NarrationContext {
  mode: NarrationMode;
  locationKey: string;
  biomeKey: string;
  enemyName?: string;
  tookDamage?: boolean;
  dealtDamage?: boolean;
  itemNames?: string[];
}

export interface FlavorLine {
  id: string;
  modes: NarrationMode[];
  tags: string[];
  text: string;
}

const allFlavorLines: FlavorLine[] = [
  ...(searchLines as FlavorLine[]),
  ...(combatLines as FlavorLine[]),
  ...(roomLines as FlavorLine[]),
];

function tagSetFromContext(ctx: NarrationContext): Set<string> {
  return new Set<string>([
    'default',
    `location:${ctx.locationKey}`,
    `biome:${ctx.biomeKey}`,
  ]);
}

function tagsIntersect(tags: string[], tagSet: Set<string>): boolean {
  return tags.some(tag => tagSet.has(tag));
}

function pickFlavorLine(lines: FlavorLine[], ctx: NarrationContext): FlavorLine | null {
  const tagSet = tagSetFromContext(ctx);
  const matches = lines.filter(line =>
    line.modes.includes(ctx.mode) && tagsIntersect(line.tags, tagSet)
  );
  if (matches.length > 0) {
    return matches[Math.floor(Math.random() * matches.length)];
  }

  const fallback = lines.filter(line =>
    line.modes.includes(ctx.mode) && line.tags.includes('default')
  );
  if (fallback.length === 0) return null;
  return fallback[Math.floor(Math.random() * fallback.length)];
}

function renderTemplate(text: string, ctx: NarrationContext): string {
  const locationText = ctx.locationKey.replace(/_/g, ' ');
  const itemsText = ctx.itemNames && ctx.itemNames.length > 0
    ? ctx.itemNames.join(', ')
    : 'your find';
  return text
    .replace(/\{enemy\}/g, ctx.enemyName ?? 'enemy')
    .replace(/\{items\}/g, itemsText)
    .replace(/\{location\}/g, locationText);
}

export function generateCannedFlavor(ctx: NarrationContext): string | null {
  if (ctx.mode === 'SHEET') return null;

  const line = pickFlavorLine(allFlavorLines, ctx);
  if (!line) return null;

  return renderTemplate(line.text, ctx);
}
