import { describe, expect, it } from "vitest";

import {
  advanceRound,
  createInitialGame,
  enablePlayerInput,
  pickRandomColor,
  startGame,
  submitColor,
} from "../src/index";

describe("memory game engine", () => {
  it("creates an idle game", () => {
    expect(createInitialGame()).toEqual({
      status: "idle",
      round: 0,
      score: 0,
      sequence: [],
      playerInput: [],
      failedAt: null,
    });
  });

  it("maps the random source to one of the four colors", () => {
    expect(pickRandomColor(() => 0)).toBe("green");
    expect(pickRandomColor(() => 0.25)).toBe("red");
    expect(pickRandomColor(() => 0.5)).toBe("yellow");
    expect(pickRandomColor(() => 0.999)).toBe("blue");
  });

  it("starts at round one and locks input while showing the sequence", () => {
    const game = startGame(() => 0.5);

    expect(game.status).toBe("showing-sequence");
    expect(game.round).toBe(1);
    expect(game.sequence).toEqual(["yellow"]);
    expect(submitColor(game, "yellow").outcome).toBe("ignored");
  });

  it("completes a round after the full correct sequence", () => {
    const game = enablePlayerInput(startGame(() => 0));
    const result = submitColor(game, "green");

    expect(result.outcome).toBe("round-complete");
    expect(result.state.status).toBe("round-success");
    expect(result.state.score).toBe(1);
  });

  it("marks the exact position of an incorrect input", () => {
    const game = enablePlayerInput(startGame(() => 0));
    const result = submitColor(game, "blue");

    expect(result.outcome).toBe("incorrect");
    expect(result.state.status).toBe("game-over");
    expect(result.state.failedAt).toBe(0);
  });

  it("preserves the sequence and appends a color in the next round", () => {
    const roundOne = submitColor(
      enablePlayerInput(startGame(() => 0)),
      "green",
    ).state;
    const roundTwo = advanceRound(roundOne, () => 0.75);

    expect(roundTwo.status).toBe("showing-sequence");
    expect(roundTwo.round).toBe(2);
    expect(roundTwo.sequence).toEqual(["green", "blue"]);
    expect(roundTwo.playerInput).toEqual([]);
  });
});
