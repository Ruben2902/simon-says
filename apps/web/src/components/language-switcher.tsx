"use client";

import { useI18n } from "@/i18n/i18n-provider";
import type { Locale } from "@/i18n/translations";

const OPTIONS: Array<{ label: string; locale: Locale }> = [
  { label: "EN", locale: "en" },
  { label: "ES", locale: "es" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-control">
      <span className="language-label">{t("language.selector")}</span>
      <div
        className="language-switcher"
        role="group"
        aria-label={t("language.selector")}
      >
        {OPTIONS.map((option) => (
          <button
            aria-label={t(
              option.locale === "en" ? "language.english" : "language.spanish",
            )}
            aria-pressed={locale === option.locale}
            className={locale === option.locale ? "is-active" : undefined}
            key={option.locale}
            onClick={() => setLocale(option.locale)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
