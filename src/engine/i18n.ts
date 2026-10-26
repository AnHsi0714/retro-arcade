import { getString, setString } from "./storage";

export type Lang = "en" | "zh";

/** Text in both languages. Written inline where it is used: tr({ en: "READY", zh: "準備" }). */
export interface Localized {
  en: string;
  zh: string;
}

/** Plain strings are language-neutral (names, numbers, key labels). */
export type Text = string | Localized;

const LANG_KEY = "lang";

function initialLang(): Lang {
  const saved = getString(LANG_KEY);
  if (saved === "en" || saved === "zh") return saved;
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

let current: Lang = initialLang();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  setString(LANG_KEY, lang);
}

export function toggleLang(): Lang {
  setLang(current === "en" ? "zh" : "en");
  return current;
}

/** Resolves text for the current language. Call at draw time so a switch applies immediately. */
export function tr(text: Text): string {
  return typeof text === "string" ? text : text[current];
}

/** Display name of a language, in that language. */
export const LANG_NAMES: Record<Lang, string> = { en: "English", zh: "中文" };
