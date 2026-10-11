/** Bound selected completed model text by Unicode code points. */
export function shrinkText(text: string, limit = 4_000): string {
  return Array.from(text).slice(0, limit).join("");
}
