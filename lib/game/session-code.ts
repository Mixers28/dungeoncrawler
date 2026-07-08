export const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SESSION_CODE_LENGTH = 6;
export const SESSION_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export function normalizeSessionCodeInput(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, SESSION_CODE_LENGTH);
}

export function isValidSessionCode(value: string): boolean {
  return SESSION_CODE_PATTERN.test(value);
}
