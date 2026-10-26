import { useRef } from "react";

export function PhotoStep({ onPhoto, onDemo }: { onPhoto: (file: File) => void; onDemo: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="card photo-step">
      <h1>Montre m kaye ou</h1>
      <p className="lead">
        Pran yon foto egzèsis ou ekri alamen an. MATON ap jwenn etap kote rezonman an chanje chemen, li ap
        make l sou pwòp paj ou, epi li ap eksplike w li an kreyòl.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPhoto(file);
          e.target.value = "";
        }}
      />
      <button className="primary" onClick={() => input.current?.click()}>
        Pran oswa chwazi yon foto
      </button>
      <button className="secondary" onClick={onDemo}>
        Eseye ak kaye demo a
      </button>
      <p className="fine">
        Foto a redwi sou aparèy ou anvan li voye, san done GPS ladan l. MATON pa anrejistre l.
      </p>
    </section>
  );
}
