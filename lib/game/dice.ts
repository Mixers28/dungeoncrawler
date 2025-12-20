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
        total += sign * (Math.floor(Math.random() * faces) + 1);
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
