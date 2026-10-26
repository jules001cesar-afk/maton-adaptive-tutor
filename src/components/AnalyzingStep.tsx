// All three jobs run at the same time on the server, so they are shown as running
// together; nothing here pretends to know which one finished first.
const JOBS = [
  ["Muse Spark", "ap li ekriti a epi chèche kote rezonman an chanje chemen"],
  ["SAM 3.1", "ap jwenn chak chif ak chak siy egal sou paj la"],
  ["Kòd MATON", "ap refè chak kalkil pou verifye yo"],
] as const;

export function AnalyzingStep({ photoUrl }: { photoUrl: string }) {
  return (
    <section className="card analyzing" aria-live="polite">
      <div className="scan">
        <img src={photoUrl} alt="Foto kaye a" />
        <div className="scan-line" />
      </div>
      <ul className="jobs">
        {JOBS.map(([who, what]) => (
          <li key={who}>
            <span className="spinner" aria-hidden="true" />
            <span>
              <strong>{who}</strong> {what}
            </span>
          </li>
        ))}
      </ul>
      <p className="fine">Sa pran anviwon 10 segonn.</p>
    </section>
  );
}
