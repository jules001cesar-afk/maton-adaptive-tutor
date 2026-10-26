// Shows a problem the way it is written on paper: stacked fractions, × ÷, exponents.
import { Fragment } from "react";

export function MathText({ text }: { text: string }) {
  const parts = text
    .replace(/\*/g, "×")
    .replace(/(\d)\s*-\s*(\d)/g, "$1 − $2")
    .split(/(\d+\/\d+|\^\d+)/g)
    .filter(Boolean);
  return (
    <span className="math">
      {parts.map((p, i) => {
        const frac = /^(\d+)\/(\d+)$/.exec(p);
        if (frac) {
          return (
            <span className="frac" key={i}>
              <span>{frac[1]}</span>
              <span>{frac[2]}</span>
            </span>
          );
        }
        if (p.startsWith("^")) return <sup key={i}>{p.slice(1)}</sup>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </span>
  );
}
