// A small exact evaluator for what students write: + - × ÷ : / ^, parentheses,
// implicit multiplication (2x, 3(4)), decimals, and one unknown in equations.
import { add, div, equals, fromDecimal, mul, pow, rat, sub, type Rational } from "./rational.ts";

/** Unify the many ways people write math (handwriting transcriptions, Haitian/French habits). */
export function normalize(text: string, equationMode: boolean): string {
  let s = text
    .replace(/[−–—]/g, "-")
    .replace(/[·•∙]/g, "*")
    .replace(/×/g, "*")
    .replace(/:/g, "÷")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/(\d),(\d)/g, "$1.$2");
  // In plain arithmetic a letter x between numbers is a times sign; in equations it is the unknown.
  s = equationMode ? s.replace(/\b[a-wyzA-Z]\b/g, "x").replace(/X/g, "x") : s.replace(/[xX]/g, "*");
  return s.replace(/\s+/g, "");
}

type Token = { kind: "num"; value: Rational } | { kind: "x" } | { kind: "op"; value: string };

function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    // "1/2" written with digits on both sides is one number, a fraction. It binds tighter
    // than ÷ and ×, the way students read it: 1/2 ÷ 1/4 is (1/2) ÷ (1/4).
    const num = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?)(?![\d.^]))?/.exec(s.slice(i));
    if (num) {
      const value = fromDecimal(num[1]);
      out.push({ kind: "num", value: num[2] ? div(value, fromDecimal(num[2])) : value });
      i += num[0].length;
    } else if (c === "x") {
      out.push({ kind: "x" });
      i++;
    } else if ("+-*/÷^()".includes(c)) {
      out.push({ kind: "op", value: c });
      i++;
    } else {
      throw new Error(`unexpected "${c}"`);
    }
  }
  return out;
}

/** Evaluate an expression exactly. `x` is the value of the unknown, if any. */
export function evaluate(text: string, x?: Rational, equationMode = x !== undefined): Rational {
  const tokens = tokenize(normalize(text, equationMode));
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.kind === "op" && (peek() as { value: string }).value === v;

  function primary(): Rational {
    const t = tokens[pos++];
    if (!t) throw new Error("expression ends too early");
    if (t.kind === "num") return t.value;
    if (t.kind === "x") {
      if (!x) throw new Error("unknown without a value");
      return x;
    }
    if (t.value === "(") {
      const v = expr();
      if (!isOp(")")) throw new Error("missing )");
      pos++;
      return v;
    }
    if (t.value === "-") return sub(rat(0), unary());
    throw new Error(`unexpected "${t.value}"`);
  }
  function unary(): Rational {
    if (isOp("-")) {
      pos++;
      return sub(rat(0), unary());
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return primary();
  }
  function power(): Rational {
    const base = unary();
    if (isOp("^")) {
      pos++;
      return pow(base, power());
    }
    return base;
  }
  function term(): Rational {
    let v = power();
    for (;;) {
      const t = peek();
      if (t?.kind === "op" && (t.value === "*" || t.value === "/" || t.value === "÷")) {
        pos++;
        v = t.value === "*" ? mul(v, power()) : div(v, power());
      } else if (t && (t.kind === "num" || t.kind === "x" || (t.kind === "op" && t.value === "("))) {
        v = mul(v, power()); // implicit: 2x, 3(4)
      } else {
        return v;
      }
    }
  }
  function expr(): Rational {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { value: string }).value;
      v = op === "+" ? add(v, term()) : sub(v, term());
    }
    return v;
  }

  const result = expr();
  if (pos !== tokens.length) throw new Error("extra symbols at the end");
  return result;
}

export type Solution = { kind: "one"; x: Rational } | { kind: "all" } | { kind: "none" };

/** Solve a linear equation in one unknown, e.g. "2x + 3 = 11". Throws if it is not linear. */
export function solveLinear(equation: string): Solution {
  const sides = equation.split("=");
  if (sides.length !== 2) throw new Error("an equation needs exactly one =");
  const f = (v: number) => sub(evaluate(sides[0], rat(v), true), evaluate(sides[1], rat(v), true));
  const f0 = f(0);
  const slope = sub(f(1), f0);
  if (!equals(f(2), add(f0, mul(rat(2), slope)))) throw new Error("not a linear equation");
  if (slope.n === 0) return f0.n === 0 ? { kind: "all" } : { kind: "none" };
  return { kind: "one", x: div(sub(rat(0), f0), slope) };
}
