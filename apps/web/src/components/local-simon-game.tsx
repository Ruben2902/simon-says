"use client";

import {
  advanceRound,
  createInitialGame,
  enablePlayerInput,
  startGame,
  submitColor,
  type GameStatus,
} from "@simon/game-engine";
import { SIMON_COLORS, type SimonColor } from "@simon/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translations";

const COLOR_LABEL_KEYS: Record<SimonColor, TranslationKey> = {
  green: "board.green",
  red: "board.red",
  yellow: "board.yellow",
  blue: "board.blue",
};

const FREQUENCIES: Record<SimonColor, number> = {
  green: 329.63,
  red: 261.63,
  yellow: 392,
  blue: 196,
};

const STATUS_KEYS: Record<GameStatus, TranslationKey> = {
  idle: "local.idle",
  "showing-sequence": "local.showingSequence",
  "accepting-input": "local.acceptingInput",
  "round-success": "local.roundSuccess",
  "game-over": "local.gameOver",
};

function useSimonAudio() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playTone = useCallback((color: SimonColor, duration = 0.22) => {
    const AudioContextClass = window.AudioContext;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(FREQUENCIES[color], now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }, []);

  return playTone;
}

export function LocalSimonGame() {
  const { t } = useI18n();
  const [game, setGame] = useState(createInitialGame);
  const [activeColor, setActiveColor] = useState<SimonColor | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const playTone = useSimonAudio();

  useEffect(() => {
    if (game.status !== "showing-sequence") {
      return;
    }

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const stepDuration = 700;

    game.sequence.forEach((color, index) => {
      timers.push(
        setTimeout(
          () => {
            setActiveColor(color);
            playTone(color, 0.34);
          },
          420 + index * stepDuration,
        ),
      );
      timers.push(
        setTimeout(() => setActiveColor(null), 860 + index * stepDuration),
      );
    });

    timers.push(
      setTimeout(
        () => setGame((current) => enablePlayerInput(current)),
        420 + game.sequence.length * stepDuration,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [game.sequence, game.status, playTone]);

  useEffect(() => {
    if (game.status !== "round-success") {
      return;
    }

    const timer = setTimeout(() => {
      setGame((current) => advanceRound(current));
    }, 950);

    return () => clearTimeout(timer);
  }, [game.status]);

  const handleStart = () => {
    setActiveColor(null);
    setGame(startGame());
  };

  const handleColor = (color: SimonColor) => {
    if (game.status !== "accepting-input") {
      return;
    }

    setActiveColor(color);
    playTone(color);
    window.setTimeout(() => setActiveColor(null), 230);
    const result = submitColor(game, color);
    setGame(result.state);

    if (result.state.score > bestScore) {
      setBestScore(result.state.score);
    }
  };

  const inputProgress = `${game.playerInput.length}/${game.sequence.length}`;

  return (
    <section className="console" aria-labelledby="game-title">
      <div className="console-screw screw-one" aria-hidden="true" />
      <div className="console-screw screw-two" aria-hidden="true" />
      <div className="console-header">
        <div>
          <p className="console-kicker">{t("local.kicker")}</p>
          <h2 id="game-title">{t("local.title")}</h2>
        </div>
        <div
          className="round-counter"
          aria-label={t("match.roundAria", { round: game.round })}
        >
          <small>{t("local.round")}</small>
          <strong>{String(game.round).padStart(2, "0")}</strong>
        </div>
      </div>

      <div className="display-panel" aria-live="polite">
        <span className={`display-beacon status-${game.status}`} />
        <div>
          <small>{t("local.status")}</small>
          <p>{t(STATUS_KEYS[game.status])}</p>
        </div>
        <span className="input-progress">{inputProgress}</span>
      </div>

      <div className="simon-board" aria-label={t("board.aria")}>
        {SIMON_COLORS.map((color, index) => {
          const colorLabel = t(COLOR_LABEL_KEYS[color]);
          return (
            <button
              aria-label={t("board.position", {
                color: colorLabel,
                position: index + 1,
              })}
              aria-pressed={activeColor === color}
              className={`simon-key simon-${color} ${activeColor === color ? "is-active" : ""}`}
              disabled={game.status !== "accepting-input"}
              key={color}
              onClick={() => handleColor(color)}
              type="button"
            >
              <span className="key-number">0{index + 1}</span>
              <span className="key-label">{colorLabel}</span>
            </button>
          );
        })}
        <div className="board-core" aria-hidden="true">
          <span>SIMON</span>
          <i />
          <small>{t("board.memoryUnit")}</small>
        </div>
      </div>

      <div className="console-footer">
        <div className="score-cell">
          <small>{t("local.points")}</small>
          <strong>{String(game.score).padStart(2, "0")}</strong>
        </div>
        <div className="score-cell">
          <small>{t("local.best")}</small>
          <strong>{String(bestScore).padStart(2, "0")}</strong>
        </div>
        <button className="start-button" onClick={handleStart} type="button">
          <span>
            {game.status === "idle" ? t("local.start") : t("local.restart")}
          </span>
          <i aria-hidden="true">→</i>
        </button>
      </div>
    </section>
  );
}
