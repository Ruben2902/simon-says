import { SIMON_COLORS, type SimonColor } from "@simon/shared-types";

export type GameStatus =
  | "idle"
  | "showing-sequence"
  | "accepting-input"
  | "round-success"
  | "game-over";

export interface MemoryGameState {
  status: GameStatus;
  round: number;
  score: number;
  sequence: SimonColor[];
  playerInput: SimonColor[];
  failedAt: number | null;
}

export type InputOutcome =
  "ignored" | "correct-partial" | "round-complete" | "incorrect";

export interface InputResult {
  state: MemoryGameState;
  outcome: InputOutcome;
}

export type RandomSource = () => number;

export function createInitialGame(): MemoryGameState {
  return {
    status: "idle",
    round: 0,
    score: 0,
    sequence: [],
    playerInput: [],
    failedAt: null,
  };
}

export function pickRandomColor(
  random: RandomSource = Math.random,
): SimonColor {
  const safeRandom = Math.min(Math.max(random(), 0), 0.999999999);
  const index = Math.floor(safeRandom * SIMON_COLORS.length);

  return SIMON_COLORS[index];
}

export function startGame(random: RandomSource = Math.random): MemoryGameState {
  return {
    ...createInitialGame(),
    status: "showing-sequence",
    round: 1,
    sequence: [pickRandomColor(random)],
  };
}

export function enablePlayerInput(state: MemoryGameState): MemoryGameState {
  if (state.status !== "showing-sequence") {
    return state;
  }

  return {
    ...state,
    status: "accepting-input",
    playerInput: [],
  };
}

export function submitColor(
  state: MemoryGameState,
  color: SimonColor,
): InputResult {
  if (state.status !== "accepting-input") {
    return { state, outcome: "ignored" };
  }

  const inputIndex = state.playerInput.length;
  const nextInput = [...state.playerInput, color];

  if (state.sequence[inputIndex] !== color) {
    return {
      state: {
        ...state,
        status: "game-over",
        playerInput: nextInput,
        failedAt: inputIndex,
      },
      outcome: "incorrect",
    };
  }

  if (nextInput.length === state.sequence.length) {
    return {
      state: {
        ...state,
        status: "round-success",
        score: state.round,
        playerInput: nextInput,
      },
      outcome: "round-complete",
    };
  }

  return {
    state: { ...state, playerInput: nextInput },
    outcome: "correct-partial",
  };
}

export function advanceRound(
  state: MemoryGameState,
  random: RandomSource = Math.random,
): MemoryGameState {
  if (state.status !== "round-success") {
    return state;
  }

  return {
    ...state,
    status: "showing-sequence",
    round: state.round + 1,
    sequence: [...state.sequence, pickRandomColor(random)],
    playerInput: [],
    failedAt: null,
  };
}
