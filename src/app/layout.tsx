import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { getAppLocale } from "@/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: { default: t("common.appName"), template: `%s · ${t("common.appName")}` },
    description: t("meta.description"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getAppLocale();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
