export type RandomSource = () => number;

// All dice flow through this one source so tests (and any future seeded replay)
// can substitute it instead of reassigning the global Math.random. The default
// calls Math.random lazily, so existing global stubs keep working.
let randomSource: RandomSource = () => Math.random();

export function setRandomSource(source: RandomSource | null): void {
  randomSource = source ?? (() => Math.random());
}

export function rollDice(notation: string): number {
  const tokens = notation.replace(/\s+/g, '').match(/[+-]?[^+-]+/g) || [];
  if (tokens.length === 0) throw new Error(`Invalid dice expression: "${notation}"`);

  let total = 0;

  for (const token of tokens) {
    const sign = token.startsWith('-') ? -1 : 1;
    const body = token.replace(/^[-+]/, '');

    if (body.includes('d')) {
      const [countStr, facesStr] = body.split('d');
      const count = countStr ? Number(countStr) : 1;
      const faces = Number(facesStr);
      if (!Number.isFinite(count) || !Number.isFinite(faces) || count <= 0 || faces <= 0) {
        throw new Error(`Invalid dice term: "${token}"`);
      }
      for (let i = 0; i < count; i++) {
        total += sign * (Math.floor(randomSource() * faces) + 1);
      }
    } else {
      const flat = Number(body);
      if (!Number.isFinite(flat)) throw new Error(`Invalid modifier: "${token}"`);
      total += sign * flat;
    }
  }

  return total;
}

export function rollD20(): number {
  return rollDice('1d20');
}

// D&D-style critical hits roll damage dice twice while applying flat modifiers once.
// For example, `1d8 + 3` becomes `2d8 + 3` rather than doubling the whole result.
export function rollCriticalDamage(notation: string): number {
  const criticalNotation = notation.replace(/([+-]?)(\d*)d(\d+)/gi, (_term, sign, count, faces) => {
    const doubledCount = (count ? Number(count) : 1) * 2;
    return `${sign}${doubledCount}d${faces}`;
  });
  return rollDice(criticalNotation);
}

export function d20AttackHits(rawD20: number, total: number, targetAc: number): boolean {
  return rawD20 !== 1 && (rawD20 === 20 || total >= targetAc);
}
