"use client";

import { useState, type FormEvent } from "react";

interface RoomEntryProps {
  connected: boolean;
  error: string;
  pending: boolean;
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
}

export function RoomEntry({
  connected,
  error,
  pending,
  onCreate,
  onJoin,
}: RoomEntryProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreate(name);
  };

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onJoin(name, code);
  };

  return (
    <section className="room-entry" aria-labelledby="room-entry-title">
      <div className="entry-heading">
        <p className="console-kicker">Canal multijugador</p>
        <h2 id="room-entry-title">Entra al duelo</h2>
        <span className={`connection-pill ${connected ? "is-online" : ""}`}>
          <i /> {connected ? "Servidor conectado" : "Conectando…"}
        </span>
      </div>

      <label className="field-label" htmlFor="player-name">
        Tu nombre
      </label>
      <input
        aria-describedby={error ? "room-form-error" : undefined}
        aria-invalid={Boolean(error)}
        autoComplete="nickname"
        className="text-field"
        id="player-name"
        maxLength={18}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ej. Alex"
        value={name}
      />

      <div className="entry-actions">
        <form className="entry-card create-card" onSubmit={handleCreate}>
          <span className="entry-number">01</span>
          <div>
            <h3>Crear sala</h3>
            <p>Recibe un código para compartir.</p>
          </div>
          <button disabled={!connected || pending} type="submit">
            Crear <span aria-hidden="true">→</span>
          </button>
        </form>

        <form className="entry-card join-card" onSubmit={handleJoin}>
          <span className="entry-number">02</span>
          <div>
            <h3>Unirse</h3>
            <p>Ingresa el código de cinco caracteres.</p>
          </div>
          <label className="sr-only" htmlFor="room-code">
            Código de sala
          </label>
          <input
            aria-describedby={error ? "room-form-error" : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="off"
            className="code-field"
            id="room-code"
            maxLength={5}
            onChange={(event) =>
              setCode(
                event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""),
              )
            }
            placeholder="ABCDE"
            value={code}
          />
          <button disabled={!connected || pending} type="submit">
            Entrar <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>

      <p className="form-error" id="room-form-error" role="alert">
        {error}
      </p>
    </section>
  );
}
