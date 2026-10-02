"use client";

import type {
  GamePhase,
  PlayerSnapshot,
  SimonColor,
} from "@simon/shared-types";

import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translations";

import { SimonBoard } from "./simon-board";

const PHASE_LABEL_KEYS: Record<GamePhase, TranslationKey> = {
  lobby: "phase.lobby",
  countdown: "phase.countdown",
  "showing-sequence": "phase.showingSequence",
  "accepting-input": "phase.acceptingInput",
  "round-result": "phase.roundResult",
  finished: "phase.finished",
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
  const { t } = useI18n();
  const currentPlayer = players.find((player) => player.id === currentPlayerId);

  return (
    <section className="console match-console" aria-labelledby="match-title">
      <div className="console-screw screw-one" aria-hidden="true" />
      <div className="console-screw screw-two" aria-hidden="true" />
      <div className="console-header">
        <div>
          <p className="console-kicker">{t("match.kicker")}</p>
          <h2 id="match-title">{t("match.title")}</h2>
        </div>
        <div className="console-controls">
          <button
            aria-label={muted ? t("match.enableSound") : t("match.muteSound")}
            aria-pressed={muted}
            className="audio-toggle"
            onClick={onToggleMute}
            type="button"
          >
            {muted ? t("match.soundOff") : t("match.soundOn")}
          </button>
          <div
            className="round-counter"
            aria-label={t("match.roundAria", { round })}
          >
            <small>{t("match.round")}</small>
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
            <span>
              {player.id === currentPlayerId
                ? t("match.you")
                : t("match.opponent")}
            </span>
            <strong>{player.name}</strong>
            <small>
              {player.connected ? t("match.online") : t("match.reconnecting")} ·{" "}
              {String(player.score).padStart(2, "0")} {t("match.points")} ·{" "}
              {player.progress}/{sequenceLength}
            </small>
          </article>
        ))}
      </div>

      <div className="display-panel" aria-live="polite">
        <span className={`display-beacon status-${phase}`} />
        <div>
          <small>{t(PHASE_LABEL_KEYS[phase])}</small>
          <p>{message}</p>
        </div>
        <span className="input-progress" aria-label={t("match.progressAria")}>
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
            <small>{t("match.syncing")}</small>
            <strong>{countdown}</strong>
          </div>
        ) : null}
      </div>

      <div className="match-legend">
        <span>
          <i className="legend-light observe" /> {t("match.observe")}
        </span>
        <span>
          <i className="legend-light respond" /> {t("match.respond")}
        </span>
        <span>{t("match.controls")}</span>
      </div>
    </section>
  );
}
