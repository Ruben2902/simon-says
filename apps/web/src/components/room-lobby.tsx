"use client";

import type { RoomSnapshot } from "@simon/shared-types";
import { useState } from "react";

interface RoomLobbyProps {
  playerId: string;
  room: RoomSnapshot;
  onLeave: () => void;
  onReady: (ready: boolean) => void;
}

export function RoomLobby({
  playerId,
  room,
  onLeave,
  onReady,
}: RoomLobbyProps) {
  const [copied, setCopied] = useState(false);
  const currentPlayer = room.players.find((player) => player.id === playerId);

  const copyCode = async () => {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <section className="lobby-panel" aria-labelledby="lobby-title">
      <div className="lobby-topline">
        <div>
          <p className="console-kicker">Frecuencia privada</p>
          <h2 id="lobby-title">Sala {room.code}</h2>
        </div>
        <button className="ghost-button" onClick={onLeave} type="button">
          Salir
        </button>
      </div>

      <button className="room-code-display" onClick={copyCode} type="button">
        <small>Código de enlace</small>
        <strong>{room.code}</strong>
        <span>{copied ? "Copiado" : "Copiar código"}</span>
      </button>

      <div className="player-slots">
        {[0, 1].map((slot) => {
          const player = room.players[slot];
          return (
            <article
              className={`player-slot ${player ? "is-filled" : ""}`}
              key={slot}
            >
              <span className="slot-index">0{slot + 1}</span>
              {player ? (
                <>
                  <div className="player-avatar" aria-hidden="true">
                    {player.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h3>
                      {player.name}{" "}
                      {player.id === playerId ? <em>TÚ</em> : null}
                    </h3>
                    <p>
                      {!player.connected
                        ? "Reconectando…"
                        : player.ready
                          ? "Listo para jugar"
                          : "Preparándose"}
                    </p>
                  </div>
                  <i
                    aria-hidden="true"
                    className={
                      player.ready && player.connected
                        ? "ready-light is-ready"
                        : "ready-light"
                    }
                  />
                </>
              ) : (
                <div className="empty-player">
                  <span className="waiting-radar" />
                  <div>
                    <h3>Esperando rival</h3>
                    <p>Comparte el código de la sala</p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="lobby-footer">
        <p>
          {room.players.length < 2
            ? "El duelo se habilitará cuando llegue el segundo jugador."
            : "Ambos jugadores deben confirmar para comenzar."}
        </p>
        <button
          className={`ready-button ${currentPlayer?.ready ? "is-ready" : ""}`}
          disabled={
            room.players.length < 2 ||
            room.players.some((player) => !player.connected)
          }
          onClick={() => onReady(!currentPlayer?.ready)}
          type="button"
        >
          {currentPlayer?.ready ? "Cancelar listo" : "Estoy listo"}
          <span aria-hidden="true">●</span>
        </button>
      </div>
    </section>
  );
}
