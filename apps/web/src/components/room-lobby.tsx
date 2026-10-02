"use client";

import type { RoomSnapshot } from "@simon/shared-types";
import { useState } from "react";

import { useI18n } from "@/i18n/i18n-provider";

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
  const { t } = useI18n();
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
          <p className="console-kicker">{t("lobby.kicker")}</p>
          <h2 id="lobby-title">{t("lobby.title", { code: room.code })}</h2>
        </div>
        <button className="ghost-button" onClick={onLeave} type="button">
          {t("lobby.leave")}
        </button>
      </div>

      <button className="room-code-display" onClick={copyCode} type="button">
        <small>{t("lobby.linkCode")}</small>
        <strong>{room.code}</strong>
        <span>{copied ? t("lobby.copied") : t("lobby.copyCode")}</span>
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
                      {player.id === playerId ? (
                        <em>{t("lobby.you")}</em>
                      ) : null}
                    </h3>
                    <p>
                      {!player.connected
                        ? t("lobby.reconnecting")
                        : player.ready
                          ? t("lobby.ready")
                          : t("lobby.preparing")}
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
                    <h3>{t("lobby.waitingOpponent")}</h3>
                    <p>{t("lobby.shareCode")}</p>
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
            ? t("lobby.waitingSecond")
            : t("lobby.bothConfirm")}
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
          {currentPlayer?.ready ? t("lobby.cancelReady") : t("lobby.imReady")}
          <span aria-hidden="true">●</span>
        </button>
      </div>
    </section>
  );
}
