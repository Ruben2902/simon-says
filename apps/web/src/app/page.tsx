import { MultiplayerSimonGame } from "@/components/multiplayer-simon-game";

export default function Home() {
  return (
    <main className="page-shell">
      <a className="skip-link" href="#game-area">
        Ir al juego
      </a>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="masthead">
        <a
          className="brand"
          href="#game-area"
          aria-label="Simon Says, ir al juego"
        >
          <span className="brand-dot" />
          SIMON SAYS
        </a>
        <span className="phase-tag">v1.0 · Listo para jugar</span>
      </header>

      <section className="hero" id="game-area">
        <div className="hero-copy">
          <p className="eyebrow">Laboratorio de memoria</p>
          <h1>
            Conecta.
            <br />
            Memoriza.
            <br />
            <span>Gana.</span>
          </h1>
          <p className="hero-description">
            Dos jugadores. Una misma secuencia. Cada señal decide quién sigue en
            pie.
          </p>

          <div className="status-strip" aria-label="Estado del prototipo">
            <span>
              <i className="status-light" /> Servidor autoritativo
            </span>
            <span>Reconexión automática · Controles 1–4</span>
          </div>
        </div>

        <MultiplayerSimonGame />
      </section>

      <footer className="footer-note">
        <span>01</span>
        <p>Crea una sala, comparte el código y confirma cuando estés listo.</p>
      </footer>
    </main>
  );
}
