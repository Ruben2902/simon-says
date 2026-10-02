"use client";

import { useI18n } from "@/i18n/i18n-provider";

import { LanguageSwitcher } from "./language-switcher";
import { MultiplayerSimonGame } from "./multiplayer-simon-game";

export function GameExperience() {
  const { t } = useI18n();

  return (
    <main className="page-shell">
      <a className="skip-link" href="#game-area">
        {t("page.skip")}
      </a>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="masthead">
        <a className="brand" href="#game-area" aria-label={t("page.brandAria")}>
          <span className="brand-dot" />
          SIMON SAYS
        </a>
        <div className="masthead-tools">
          <span className="phase-tag">{t("page.phase")}</span>
          <LanguageSwitcher />
        </div>
      </header>

      <section className="hero" id="game-area">
        <div className="hero-copy">
          <p className="eyebrow">{t("page.eyebrow")}</p>
          <h1>
            {t("page.heroConnect")}
            <br />
            {t("page.heroMemorize")}
            <br />
            <span>{t("page.heroWin")}</span>
          </h1>
          <p className="hero-description">{t("page.description")}</p>

          <div className="status-strip" aria-label={t("page.phase")}>
            <span>
              <i className="status-light" /> {t("page.authoritativeServer")}
            </span>
            <span>{t("page.reconnectControls")}</span>
          </div>
        </div>

        <MultiplayerSimonGame />
      </section>

      <footer className="footer-note">
        <span>01</span>
        <p>{t("page.footer")}</p>
      </footer>
    </main>
  );
}
