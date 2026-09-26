import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Messages } from "./messages";

/** generateMetadata() prêt à l'emploi pour un titre de page traduit. */
export function pageTitle(key: keyof Messages["meta"]) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("meta");
    return { title: t(key) };
  };
}
