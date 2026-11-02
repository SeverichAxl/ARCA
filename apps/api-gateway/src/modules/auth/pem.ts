/** Acepta PEM directo, PEM con `\n` escapados o PEM codificado en base64. */
export function normalizePem(value: string): string {
  const unescaped = value.trim().replace(/\\n/g, '\n');

  if (unescaped.includes('BEGIN')) {
    return unescaped;
  }

  const decoded = Buffer.from(unescaped, 'base64').toString('utf8').trim();
  return decoded.includes('BEGIN') ? decoded : unescaped;
}

export function isPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  return /REPLACE_WITH|change_me|CHANGE_ME/.test(value);
}
