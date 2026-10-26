import { useState } from "react";

import type { Analysis } from "../api.ts";

const PAD = 16;

/** The student's own photo with hand-drawn style marks around each step. */
export function CorrectionView({ photoUrl, width, height, analysis }: { photoUrl: string; width: number; height: number; analysis: Analysis }) {
  const [showMarks, setShowMarks] = useState(true);
  const firstWrong = analysis.steps.findIndex((s) => s.status === "wrong");

  return (
    <section className="card correction">
      <div className="toggle" role="group" aria-label="Kijan pou wè kaye a">
        <button aria-pressed={!showMarks} onClick={() => setShowMarks(false)}>
          Orijinal
        </button>
        <button aria-pressed={showMarks} onClick={() => setShowMarks(true)}>
          Koreksyon
        </button>
      </div>

      <div className="page">
        <img src={photoUrl} alt={`Kaye elèv la: ${analysis.transcription}`} />
        {showMarks && (
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
            {analysis.steps.map((s, i) => {
              const { x1, y1, x2, y2 } = s.box;
              const cx = (x1 + x2) / 2;
              const cy = (y1 + y2) / 2;
              const rx = (x2 - x1) / 2 + PAD;
              const ry = (y2 - y1) / 2 + PAD;
              return (
                <g key={i} className={`mark ${s.status}`} style={{ animationDelay: `${i * 0.35}s` }}>
                  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} pathLength={1} />
                  {i === firstWrong && <Label box={s.box} width={width} height={height} />}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <ul className="legend">
        <li>
          <span className="dot correct" /> Etap ki kòrèk
        </li>
        <li>
          <span className="dot wrong" /> Etap pou nou revize
        </li>
      </ul>
      <p className="fine">
        Mak yo: {analysis.marksFrom === "muse-spark+sam-3.1" ? "Muse Spark + SAM 3.1" : "Muse Spark"}. Chak kalkil verifye pa kòd.
      </p>
    </section>
  );
}

const LABEL = "Ann gade etap sa a";
const LABEL_WIDTH = 440; // about 18 characters at 44px

/** Beside the mark when there is room (so it never covers a step written below), else under it. */
function Label({ box, width, height }: { box: Analysis["steps"][number]["box"]; width: number; height: number }) {
  const right = box.x2 + PAD + 24;
  if (right + LABEL_WIDTH <= width) {
    return (
      <text x={right} y={(box.y1 + box.y2) / 2 + 16} textAnchor="start">
        {LABEL}
      </text>
    );
  }
  const below = box.y2 + PAD + 52;
  return (
    <text x={(box.x1 + box.x2) / 2} y={below <= height - 8 ? below : box.y1 - PAD - 16} textAnchor="middle">
      {LABEL}
    </text>
  );
}
