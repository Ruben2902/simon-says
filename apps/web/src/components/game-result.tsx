"use client";

import type { GameFinishedPayload } from "@simon/shared-types";

import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translations";

interface GameResultProps {
  currentPlayerId: string;
  result: GameFinishedPayload;
  onLeave: () => void;
  onRematch: () => void;
}

const REASON_KEYS: Record<GameFinishedPayload["reason"], TranslationKey> = {
  "opponent-failed": "result.opponentFailed",
  "furthest-progress": "result.furthestProgress",
  draw: "result.equalProgress",
  forfeit: "result.forfeit",
};

export function GameResult({
  currentPlayerId,
  result,
  onLeave,
  onRematch,
}: GameResultProps) {
  const { t } = useI18n();
  const isDraw = result.winnerId === null;
  const didWin = result.winnerId === currentPlayerId;
  const title = isDraw
    ? t("result.draw")
    : didWin
      ? t("result.win")
      : t("result.loss");

  return (
    <section className="result-panel" aria-labelledby="result-title">
      <p className="console-kicker">{t("result.kicker")}</p>
      <span
        className={`result-stamp ${didWin ? "is-win" : ""}`}
        aria-hidden="true"
      >
        {isDraw ? "=" : didWin ? "+" : "×"}
      </span>
      <h2 id="result-title">{title}</h2>
      <p>{t(REASON_KEYS[result.reason])}</p>

      <div className="result-scores">
        {result.room.players.map((player) => (
          <article key={player.id}>
            <span>
              {player.id === currentPlayerId
                ? t("result.you")
                : t("result.opponent")}
            </span>
            <strong>{player.name}</strong>
            <b>{String(player.score).padStart(2, "0")}</b>
          </article>
        ))}
      </div>

      <div className="result-actions">
        <button className="ghost-button" onClick={onLeave} type="button">
          {t("result.leave")}
        </button>
        <button className="ready-button" onClick={onRematch} type="button">
          {t("result.rematch")} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
