import type { Analysis } from "../api.ts";

export function ExplanationCard({ analysis }: { analysis: Analysis }) {
  const k = analysis.kreyol;
  const correct = analysis.misconceptionId === "none";
  return (
    <section className="card explanation" lang="ht">
      <p className="encouragement">{k.encouragement}</p>
      {!correct && (
        <div className="block">
          <h3>Sa ou te fè</h3>
          <p>{k.studentAction}</p>
        </div>
      )}
      <div className="block">
        <h3>Ide pou sonje</h3>
        <p>{k.concept}</p>
      </div>
      {k.example && (
        <div className="block example">
          <h3>Egzanp</h3>
          <p>{k.example}</p>
        </div>
      )}
      <div className="question">
        <h3>Reflechi sou sa</h3>
        <p>{k.question}</p>
      </div>
    </section>
  );
}
