const SHA_PATTERN = /^[0-9a-f]{4,64}$/i;

export function isLikelySha(value: string): boolean {
  return SHA_PATTERN.test(value.trim());
}

export function normalizeSha(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return SHA_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function sameSha(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}
