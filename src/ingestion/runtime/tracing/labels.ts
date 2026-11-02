/** A single byte limit, without splitting a Unicode code point. */
export function traceText(value: string, bytes: number) {
  const singleLine = value.replace(/[\u0000-\u001f\u007f]/g, " ");
  if (Buffer.byteLength(singleLine) <= bytes) {
    return singleLine;
  }
  let result = "";
  for (const char of singleLine) {
    if (Buffer.byteLength(result + char + "…") > bytes) {
      break;
    }
    result += char;
  }
  return result + "…";
}
