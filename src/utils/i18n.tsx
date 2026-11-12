import React, { createContext, useContext, useMemo, useState } from "react";
import en from "../locales/en.json";
import ru from "../locales/ru.json";
import { STORAGE_KEYS } from "../config";

export type Locale = "en" | "ru";

type Dictionary = Record<string, string>;
type TemplateVars = Record<string, string | number>;

type I18nContextValue = {
  lang: Locale;
  setLang: (lang: Locale) => void;
  t: (key: string, vars?: TemplateVars) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const DICTIONARIES: Record<Locale, Dictionary> = {
  en: en as Dictionary,
  ru: ru as Dictionary,
};

const SUPPORTED: Locale[] = ["en", "ru"];

/**
 * Picks the closest supported locale for a BCP-47 tag ("ru-RU" -> "ru").
 */
function matchLocale(tag: string | undefined | null): Locale | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split("-")[0];
  return SUPPORTED.find((locale) => locale === primary) ?? null;
}

/**
 * Detects the UI language from the environment.
 *
 * Spicetify's client locale is checked first (that is the language the
 * surrounding Spotify UI uses), then the webview languages, then English.
 */
function detectLanguage(): Locale {
  if (typeof window === "undefined") return "en";

  try {
    const spicetify = window.Spicetify;
    const fromSpicetify =
      matchLocale(spicetify?.Locale?.getLocale?.()) ?? matchLocale(spicetify?.Config?.locale);
    if (fromSpicetify) return fromSpicetify;
  } catch {
    // Fall through to the webview languages.
  }

  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
    document.documentElement.lang,
  ];
  for (const candidate of candidates) {
    const matched = matchLocale(candidate);
    if (matched) return matched;
  }
  return "en";
}

/**
 * Reads the persisted UI language.
 *
 * A missing preference means "follow the client language"; the choice is
 * persisted as soon as the user picks one in the settings dialog.
 */
function getStoredLanguage(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.language);
    if (raw === "ru" || raw === "en") return raw;
  } catch {
    // localStorage can be unavailable (privacy mode); detection still works.
  }
  return detectLanguage();
}

/**
 * Substitutes `{name}` placeholders in an already-resolved string.
 */
function interpolate(template: string, vars?: TemplateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Resolves a translation key for a language: target dictionary → English → key.
 */
function resolveKey(lang: Locale, key: string): string {
  const target = DICTIONARIES[lang];
  if (key in target) return target[key] as string;
  const fallback = DICTIONARIES.en;
  if (key in fallback) return fallback[key] as string;
  return key;
}

/**
 * Provides the active language and a translation function to the React tree.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Locale>(getStoredLanguage);

  const setLang = (next: Locale) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEYS.language, next);
    } catch {
      // Persisting the language preference is best-effort.
    }
    try {
      window.dispatchEvent(new CustomEvent("statswin:language-changed", { detail: { lang: next } }));
    } catch {
      // CustomEvent is unavailable in exotic environments; ignore.
    }
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: string, vars?: TemplateVars) => interpolate(resolveKey(lang, key), vars),
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Access the active language, setter and translator.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/**
 * Returns the persisted language outside of React (tracker, storage, charts).
 */
export function getCurrentLanguage(): Locale {
  return getStoredLanguage();
}

/**
 * Translates a key outside of React with optional placeholder substitution.
 */
export function tInstant(key: string, vars?: TemplateVars, lang?: Locale): string {
  const resolvedLang = lang ?? getStoredLanguage();
  return interpolate(resolveKey(resolvedLang, key), vars);
}
