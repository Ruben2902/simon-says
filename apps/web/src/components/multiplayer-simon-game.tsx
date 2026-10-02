"use client";

import { useMultiplayerSession } from "@/hooks/use-multiplayer-session";
import { useI18n } from "@/i18n/i18n-provider";

import { GameResult } from "./game-result";
import { MatchConsole } from "./match-console";
import { RoomEntry } from "./room-entry";
import { RoomLobby } from "./room-lobby";

export function MultiplayerSimonGame() {
  const { t } = useI18n();
  const game = useMultiplayerSession();

  let content;
  if (!game.room) {
    content = (
      <RoomEntry
        connected={game.connected && !game.restoring}
        error={game.error}
        onCreate={(name) => game.joinRoom("room:create", name)}
        onJoin={(name, code) => game.joinRoom("room:join", name, code)}
        pending={game.pending}
      />
    );
  } else if (game.result) {
    content = (
      <GameResult
        currentPlayerId={game.playerId}
        onLeave={game.handleLeave}
        onRematch={game.handleRematch}
        result={game.result}
      />
    );
  } else if (game.room.phase === "lobby") {
    content = (
      <RoomLobby
        onLeave={game.handleLeave}
        onReady={game.handleReady}
        playerId={game.playerId}
        room={game.room}
      />
    );
  } else {
    content = (
      <MatchConsole
        activeColor={game.activeColor}
        countdown={game.countdown}
        currentPlayerId={game.playerId}
        inputEnabled={game.usableInput}
        message={game.message}
        muted={game.muted}
        onColor={game.handleColor}
        onToggleMute={() => game.setMuted((current) => !current)}
        phase={game.room.phase}
        players={game.room.players}
        round={game.roundData?.round ?? game.room.round}
        secondsLeft={game.secondsLeft}
        sequenceLength={
          game.roundData?.sequence.length ?? Math.max(game.room.round, 1)
        }
      />
    );
  }

  return (
    <div className="game-shell">
      {game.room && (!game.connected || game.restoring) ? (
        <div className="connection-toast" role="status">
          <span aria-hidden="true" />
          {game.connected
            ? t("connection.restoring")
            : t("connection.interrupted")}
        </div>
      ) : null}
      {content}
    </div>
  );
}
