import { useState } from "react";

import { analyzePhoto, ApiError, type Analysis } from "./api.ts";
import { AnalyzingStep } from "./components/AnalyzingStep.tsx";
import { CorrectionView } from "./components/CorrectionView.tsx";
import { ExplanationCard } from "./components/ExplanationCard.tsx";
import { PhotoStep } from "./components/PhotoStep.tsx";
import { PracticeStep } from "./components/PracticeStep.tsx";
import { FALLBACK, FALLBACK_LABEL } from "./fallback.ts";
import { preparePhoto, type PreparedPhoto } from "./resize-photo.ts";

type Shown = { photoUrl: string; width: number; height: number; analysis: Analysis; recorded: boolean };
type State =
  | { step: "photo" }
  | { step: "analyzing"; photo: PreparedPhoto }
  | { step: "error"; photo: PreparedPhoto; message: string }
  | ({ step: "result" } & Shown);

export function App() {
  const [state, setState] = useState<State>({ step: "photo" });

  async function run(photo: PreparedPhoto) {
    setState({ step: "analyzing", photo });
    try {
      const analysis = await analyzePhoto(photo);
      setState({ step: "result", photoUrl: photo.url, width: photo.width, height: photo.height, analysis, recorded: false });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setState({ step: "error", photo, message: err instanceof ApiError ? err.message : "Gen yon pwoblèm. Eseye ankò." });
    }
  }

  async function fromFile(file: Blob) {
    try {
      await run(await preparePhoto(file));
    } catch {
      setState({ step: "photo" });
      alert("Foto sa a pa ka louvri. Eseye ak yon lòt foto (JPG, PNG oswa WEBP).");
    }
  }

  const showRecorded = () =>
    setState({
      step: "result",
      photoUrl: FALLBACK.photo,
      width: FALLBACK.width,
      height: FALLBACK.height,
      analysis: FALLBACK as unknown as Analysis,
      recorded: true,
    });

  return (
    <div className="app">
      <header>
        <img src="/maton-logo.png" alt="MATON" className="logo" />
        <span className="tag">Tutè kaye</span>
      </header>

      <main>
        {state.step === "photo" && (
          <PhotoStep onPhoto={fromFile} onDemo={() => fetch("/demo/notebook-1.jpg").then((r) => r.blob()).then(fromFile)} />
        )}

        {state.step === "analyzing" && <AnalyzingStep photoUrl={state.photo.url} />}

        {state.step === "error" && (
          <section className="card error-card">
            <h2>Nou pa ka analize kaye a kounya</h2>
            <p>{state.message}</p>
            <button className="primary" onClick={() => run(state.photo)}>
              Eseye ankò
            </button>
            <button className="secondary" onClick={showRecorded}>
              Wè yon egzanp anrejistre
            </button>
          </section>
        )}

        {state.step === "result" && (
          <>
            {state.recorded && (
              <p className="recorded-banner" role="note">
                {FALLBACK_LABEL}
              </p>
            )}
            <CorrectionView photoUrl={state.photoUrl} width={state.width} height={state.height} analysis={state.analysis} />
            <ExplanationCard analysis={state.analysis} />
            <PracticeStep key={state.analysis.transcription} analysis={state.analysis} />
            <button className="secondary again" onClick={() => setState({ step: "photo" })}>
              Voye yon lòt paj kaye
            </button>
          </>
        )}
      </main>

      <footer>
        Bati pou Meta Global AI Developer Hackathon 2026 ak Muse Spark ak SAM 3.1. Kalkil yo verifye pa kòd, pa pa AI a.
      </footer>
    </div>
  );
}
