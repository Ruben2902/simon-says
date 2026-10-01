"use client";

import type {
  GamePhase,
  PlayerSnapshot,
  SimonColor,
} from "@simon/shared-types";

import { SimonBoard } from "./simon-board";

const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: "Esperando jugadores",
  countdown: "El duelo comienza",
  "showing-sequence": "Observa la secuencia",
  "accepting-input": "Tu turno: repítela",
  "round-result": "Ronda superada",
  finished: "Partida finalizada",
};

interface MatchConsoleProps {
  activeColor: SimonColor | null;
  countdown: number | null;
  currentPlayerId: string;
  inputEnabled: boolean;
  message: string;
  muted: boolean;
  onColor: (color: SimonColor) => void;
  onToggleMute: () => void;
  phase: GamePhase;
  players: PlayerSnapshot[];
  round: number;
  secondsLeft: number | null;
  sequenceLength: number;
}

export function MatchConsole({
  activeColor,
  countdown,
  currentPlayerId,
  inputEnabled,
  message,
  muted,
  onColor,
  onToggleMute,
  phase,
  players,
  round,
  secondsLeft,
  sequenceLength,
}: MatchConsoleProps) {
  const currentPlayer = players.find((player) => player.id === currentPlayerId);

  return (
    <section className="console match-console" aria-labelledby="match-title">
      <div className="console-screw screw-one" aria-hidden="true" />
      <div className="console-screw screw-two" aria-hidden="true" />
      <div className="console-header">
        <div>
          <p className="console-kicker">Enlace sincronizado</p>
          <h2 id="match-title">Duelo de memoria</h2>
        </div>
        <div className="console-controls">
          <button
            aria-label={muted ? "Activar sonidos" : "Silenciar sonidos"}
            aria-pressed={muted}
            className="audio-toggle"
            onClick={onToggleMute}
            type="button"
          >
            {muted ? "Sonido off" : "Sonido on"}
          </button>
          <div className="round-counter" aria-label={`Ronda ${round}`}>
            <small>Ronda</small>
            <strong>{String(round).padStart(2, "0")}</strong>
          </div>
        </div>
      </div>

      <div className="duel-scoreboard">
        {players.map((player) => (
          <article
            className={`duel-player ${player.id === currentPlayerId ? "is-current" : ""}`}
            key={player.id}
          >
            <span>{player.id === currentPlayerId ? "Tú" : "Rival"}</span>
            <strong>{player.name}</strong>
            <small>
              {player.connected ? "En línea" : "Reconectando"} ·{" "}
              {String(player.score).padStart(2, "0")} pts · {player.progress}/
              {sequenceLength}
            </small>
          </article>
        ))}
      </div>

      <div className="display-panel" aria-live="polite">
        <span className={`display-beacon status-${phase}`} />
        <div>
          <small>{PHASE_LABELS[phase]}</small>
          <p>{message}</p>
        </div>
        <span
          className="input-progress"
          aria-label="Progreso y tiempo restante"
        >
          {secondsLeft !== null ? `${secondsLeft}s · ` : ""}
          {currentPlayer?.progress ?? 0}/{sequenceLength}
        </span>
      </div>

      <div className="board-wrap">
        <SimonBoard
          activeColor={activeColor}
          disabled={!inputEnabled}
          onColor={onColor}
        />
        {countdown !== null ? (
          <div className="countdown-overlay" aria-live="assertive">
            <small>Sincronizando</small>
            <strong>{countdown}</strong>
          </div>
        ) : null}
      </div>

      <div className="match-legend">
        <span>
          <i className="legend-light observe" /> Observar
        </span>
        <span>
          <i className="legend-light respond" /> Responder
        </span>
        <span>Teclas 1–4 · servidor autoritativo</span>
      </div>
    </section>
  );
}
