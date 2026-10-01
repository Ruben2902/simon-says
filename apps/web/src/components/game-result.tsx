"use client";

import type { GameFinishedPayload } from "@simon/shared-types";

interface GameResultProps {
  currentPlayerId: string;
  result: GameFinishedPayload;
  onLeave: () => void;
  onRematch: () => void;
}

const REASON_COPY: Record<GameFinishedPayload["reason"], string> = {
  "opponent-failed": "Una señal incorrecta decidió el duelo.",
  "furthest-progress": "Ganó quien recordó más pasos de la secuencia.",
  draw: "Ambos llegaron exactamente al mismo punto.",
  forfeit: "El rival abandonó la conexión.",
};

export function GameResult({
  currentPlayerId,
  result,
  onLeave,
  onRematch,
}: GameResultProps) {
  const isDraw = result.winnerId === null;
  const didWin = result.winnerId === currentPlayerId;
  const title = isDraw ? "Empate técnico" : didWin ? "Victoria" : "Derrota";

  return (
    <section className="result-panel" aria-labelledby="result-title">
      <p className="console-kicker">Transmisión finalizada</p>
      <span
        className={`result-stamp ${didWin ? "is-win" : ""}`}
        aria-hidden="true"
      >
        {isDraw ? "=" : didWin ? "+" : "×"}
      </span>
      <h2 id="result-title">{title}</h2>
      <p>{REASON_COPY[result.reason]}</p>

      <div className="result-scores">
        {result.room.players.map((player) => (
          <article key={player.id}>
            <span>{player.id === currentPlayerId ? "Tú" : "Rival"}</span>
            <strong>{player.name}</strong>
            <b>{String(player.score).padStart(2, "0")}</b>
          </article>
        ))}
      </div>

      <div className="result-actions">
        <button className="ghost-button" onClick={onLeave} type="button">
          Salir de la sala
        </button>
        <button className="ready-button" onClick={onRematch} type="button">
          Jugar revancha <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
