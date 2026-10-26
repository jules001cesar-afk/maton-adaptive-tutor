import { useState } from "react";

import { ApiError, checkAnswer, type Analysis } from "../api.ts";
import { MathText } from "../math-text.tsx";

const GOAL = 3;

/** New problems made by code; the answer stays on the server until the student answers. */
export function PracticeStep({ analysis }: { analysis: Analysis }) {
  const [problem, setProblem] = useState(analysis.practice);
  const [answer, setAnswer] = useState("");
  const [solved, setSolved] = useState(0);
  const [feedback, setFeedback] = useState<{ kind: "right" | "wrong" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!problem) return null;
  const done = solved >= GOAL;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!problem || !answer.trim() || busy) return;
    setBusy(true);
    try {
      const res = await checkAnswer({
        problem: problem.problem,
        answer: answer.trim(),
        misconceptionId: analysis.misconceptionId,
        operation: analysis.operation,
        level: problem.level,
      });
      if (res.correct) {
        setSolved((n) => n + 1);
        setFeedback({ kind: "right", text: "Wi, se sa! Ou jwenn li." });
        setAnswer("");
        if (res.next) setProblem(res.next);
      } else {
        setFeedback({ kind: "wrong", text: `Poko. ${analysis.kreyol.hint}` });
      }
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof ApiError ? err.message : "Gen yon pwoblèm. Eseye ankò." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card practice">
      <div className="progress" aria-label={`Pwogrè: ${solved} sou ${GOAL}`}>
        <div className="progress-head">
          <h2>Pratike</h2>
          <span>
            {Math.min(solved, GOAL)} / {GOAL}
          </span>
        </div>
        <div className="bar">
          <div style={{ width: `${(Math.min(solved, GOAL) / GOAL) * 100}%` }} />
        </div>
      </div>

      {done ? (
        <p className="mastered">
          Bravo! Ou rezoud {GOAL} egzèsis youn apre lòt. Ou metrize etap sa a. Ou ka kontinye pratike oswa voye yon lòt
          paj kaye.
        </p>
      ) : null}

      <form onSubmit={submit}>
        <p className="problem">
          <MathText text={problem.problem} />{" "}
          {problem.problem.includes("=") ? (
            <span className="eq ask">Jwenn x</span>
          ) : (
            <span className="eq">= ?</span>
          )}
        </p>
        <div className="answer-row">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Repons ou"
            inputMode="text"
            autoComplete="off"
            aria-label="Repons ou"
            maxLength={30}
          />
          <button className="primary" disabled={busy || !answer.trim()}>
            {busy ? "..." : "Verifye"}
          </button>
        </div>
        <p className="fine">Pa egzanp: 7/10, 12, 3 rès 2, x = 4</p>
      </form>

      {feedback && (
        <p className={`feedback ${feedback.kind}`} role="status">
          {feedback.text}
        </p>
      )}
    </section>
  );
}
