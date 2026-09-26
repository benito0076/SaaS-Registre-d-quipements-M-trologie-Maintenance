import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";
import type { Locale } from "./config";

export type Messages = typeof fr;
export const MESSAGES: Record<Locale, Messages> = { fr, en, es };
