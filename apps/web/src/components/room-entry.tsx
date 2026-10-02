"use client";

import { useState, type FormEvent } from "react";

import { useI18n } from "@/i18n/i18n-provider";

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
  const { t } = useI18n();
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
        <p className="console-kicker">{t("entry.kicker")}</p>
        <h2 id="room-entry-title">{t("entry.title")}</h2>
        <span className={`connection-pill ${connected ? "is-online" : ""}`}>
          <i />
          {connected ? t("entry.serverConnected") : t("entry.connecting")}
        </span>
      </div>

      <label className="field-label" htmlFor="player-name">
        {t("entry.nameLabel")}
      </label>
      <input
        aria-describedby={error ? "room-form-error" : undefined}
        aria-invalid={Boolean(error)}
        autoComplete="nickname"
        className="text-field"
        id="player-name"
        maxLength={18}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("entry.namePlaceholder")}
        value={name}
      />

      <div className="entry-actions">
        <form className="entry-card create-card" onSubmit={handleCreate}>
          <span className="entry-number">01</span>
          <div>
            <h3>{t("entry.createTitle")}</h3>
            <p>{t("entry.createBody")}</p>
          </div>
          <button disabled={!connected || pending} type="submit">
            {t("entry.createButton")} <span aria-hidden="true">→</span>
          </button>
        </form>

        <form className="entry-card join-card" onSubmit={handleJoin}>
          <span className="entry-number">02</span>
          <div>
            <h3>{t("entry.joinTitle")}</h3>
            <p>{t("entry.joinBody")}</p>
          </div>
          <label className="sr-only" htmlFor="room-code">
            {t("entry.codeLabel")}
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
            {t("entry.joinButton")} <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>

      <p className="form-error" id="room-form-error" role="alert">
        {error}
      </p>
    </section>
  );
}
