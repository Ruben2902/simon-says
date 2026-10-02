"use client";

import { SIMON_COLORS, type SimonColor } from "@simon/shared-types";

import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translations";

const COLOR_LABEL_KEYS: Record<SimonColor, TranslationKey> = {
  green: "board.green",
  red: "board.red",
  yellow: "board.yellow",
  blue: "board.blue",
};

interface SimonBoardProps {
  activeColor: SimonColor | null;
  disabled: boolean;
  onColor: (color: SimonColor) => void;
}

export function SimonBoard({
  activeColor,
  disabled,
  onColor,
}: SimonBoardProps) {
  const { t } = useI18n();

  return (
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
            disabled={disabled}
            key={color}
            onClick={() => onColor(color)}
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
        <small>{t("board.duelUnit")}</small>
      </div>
    </div>
  );
}
