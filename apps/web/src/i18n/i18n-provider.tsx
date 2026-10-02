"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  translate,
  type Locale,
  type TranslationKey,
  type TranslationVariables,
} from "./translations";

const LANGUAGE_STORAGE_KEY = "simon-says:language";
const localeListeners = new Set<() => void>();

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

function getLocaleSnapshot(): Locale {
  const savedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLocale(savedLocale) ? savedLocale : DEFAULT_LOCALE;
}

function subscribeToLocale(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      onStoreChange();
    }
  };

  localeListeners.add(onStoreChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    localeListeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getLocaleSnapshot,
    () => DEFAULT_LOCALE,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, "meta.title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", translate(locale, "meta.description"));
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);
    localeListeners.forEach((listener) => listener());
  }, []);

  const t = useCallback(
    (key: TranslationKey, variables?: TranslationVariables) =>
      translate(locale, key, variables),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
