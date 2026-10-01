"use client";

import { SIMON_COLORS, type SimonColor } from "@simon/shared-types";

const COLOR_LABELS: Record<SimonColor, string> = {
  green: "Verde",
  red: "Rojo",
  yellow: "Amarillo",
  blue: "Azul",
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
  return (
    <div className="simon-board" aria-label="Tablero de cuatro colores">
      {SIMON_COLORS.map((color, index) => (
        <button
          aria-label={`${COLOR_LABELS[color]}, posición ${index + 1}`}
          aria-pressed={activeColor === color}
          className={`simon-key simon-${color} ${activeColor === color ? "is-active" : ""}`}
          disabled={disabled}
          key={color}
          onClick={() => onColor(color)}
          type="button"
        >
          <span className="key-number">0{index + 1}</span>
          <span className="key-label">{COLOR_LABELS[color]}</span>
        </button>
      ))}
      <div className="board-core" aria-hidden="true">
        <span>SIMON</span>
        <i />
        <small>DUEL UNIT</small>
      </div>
    </div>
  );
}
