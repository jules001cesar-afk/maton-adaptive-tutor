// Exact fractions. All tutor math runs on these, never on floats and never on the model.

export type Rational = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function rat(n: number, d = 1): Rational {
  if (d === 0) throw new Error("division by zero");
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new Error("number out of range");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

/** "3.4" or "3,4" -> 17/5 */
export function fromDecimal(text: string): Rational {
  const [whole, frac = ""] = text.replace(",", ".").split(".");
  const scale = 10 ** frac.length;
  return rat(Number(whole + frac), scale);
}

export const add = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational) => rat(a.n * b.d, a.d * b.n);

export function pow(a: Rational, e: Rational): Rational {
  if (e.d !== 1 || Math.abs(e.n) > 20) throw new Error("only small whole exponents");
  let out = rat(1);
  for (let i = 0; i < Math.abs(e.n); i++) out = mul(out, a);
  return e.n < 0 ? div(rat(1), out) : out;
}

export const equals = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
export const isInteger = (a: Rational) => a.d === 1;
export const show = (a: Rational) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);
