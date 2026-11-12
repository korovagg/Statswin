import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import en from "../locales/en.json";
import ru from "../locales/ru.json";
import { STORAGE_KEYS } from "../config";

export type Locale = "en" | "ru";

/** Stored preference: a concrete language or "auto" (follow the client). */
export type LanguagePref = Locale | "auto";

type Dictionary = Record<string, string>;
type TemplateVars = Record<string, string | number>;

type I18nContextValue = {
  /** Resolved language actually used for translations. */
  lang: Locale;
  /** Stored preference ("auto" follows the client language). */
  langPref: LanguagePref;
  /** Language Statswin detects from the environment right now. */
  detectedLang: Locale;
  setLang: (lang: LanguagePref) => void;
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
function getLanguagePref(): LanguagePref {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.language);
    if (raw === "ru" || raw === "en" || raw === "auto") return raw;
  } catch {
    // localStorage can be unavailable (privacy mode); detection still works.
  }
  return "auto";
}

/**
 * Resolves the stored preference into the language that is actually used.
 */
function getStoredLanguage(): Locale {
  const pref = getLanguagePref();
  return pref === "auto" ? detectLanguage() : pref;
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
  const [langPref, setLangPref] = useState<LanguagePref>(getLanguagePref);
  // Detection reads the client locale, which can arrive after the first render
  // (Spicetify injects it during startup); re-resolve when it does.
  const [detectedLang, setDetectedLang] = useState<Locale>(detectLanguage);
  const [detectTick, setDetectTick] = useState(0);

  const lang: Locale = langPref === "auto" ? detectedLang : langPref;

  useEffect(() => {
    if (langPref !== "auto") return;
    setDetectedLang(detectLanguage());
  }, [langPref, detectTick]);

  // Poll briefly for the client locale, then stop; the webview language is
  // available immediately, so this only refines an early "en" fallback.
  useEffect(() => {
    if (langPref !== "auto" || detectedLang !== "en") return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const next = detectLanguage();
      if (next !== "en" || attempts >= 20) {
        window.clearInterval(timer);
        if (next !== "en") setDetectedLang(next);
      } else {
        setDetectTick((value) => value + 1);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [langPref, detectedLang]);

  const setLang = (next: LanguagePref) => {
    setLangPref(next);
    try {
      window.localStorage.setItem(STORAGE_KEYS.language, next);
    } catch {
      // Persisting the language preference is best-effort.
    }
    const resolved = next === "auto" ? detectLanguage() : next;
    if (next === "auto") setDetectedLang(resolved);
    try {
      window.dispatchEvent(
        new CustomEvent("statswin:language-changed", { detail: { lang: resolved } })
      );
    } catch {
      // CustomEvent is unavailable in exotic environments; ignore.
    }
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      langPref,
      detectedLang,
      setLang,
      t: (key: string, vars?: TemplateVars) => interpolate(resolveKey(lang, key), vars),
    }),
    [lang, langPref, detectedLang]
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
