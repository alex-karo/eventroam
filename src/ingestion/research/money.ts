import { currency } from "@/catalog/domain/price";

/** Currency precision is defined by Intl, including zero- and three-decimal currencies. */
export function currencyFractionDigits(code: string): number {
  currency.parse(code);
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

/** Reject precision loss instead of rounding a model-supplied amount. */
export function majorToMinor(amount: number, code: string): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be finite and nonnegative");
  }
  const precision = currencyFractionDigits(code);
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(amount));
  if (!match) {
    throw new Error("Invalid decimal amount");
  }
  const digits = `${match[1]}${match[2] ?? ""}`;
  const shift = Number(match[3] ?? 0) - (match[2]?.length ?? 0) + precision;
  if (!Number.isSafeInteger(shift) || shift < -digits.length || shift > 100) {
    throw new Error("Amount exceeds currency precision or safe integer range");
  }
  const minor =
    shift >= 0
      ? BigInt(digits) * 10n ** BigInt(shift)
      : BigInt(digits.slice(0, shift) || "0");
  if (shift < 0 && /[1-9]/.test(digits.slice(shift))) {
    throw new Error("Amount exceeds currency precision");
  }
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount exceeds safe integer range");
  }
  return Number(minor);
}

export function minorToMajor(amount: number, code: string): number {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("Invalid saved minor amount");
  }
  return amount / 10 ** currencyFractionDigits(code);
}
