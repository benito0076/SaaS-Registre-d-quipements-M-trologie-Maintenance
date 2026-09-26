import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, FileCheck2, Gauge, QrCode } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FREE_PLAN_EQUIPMENT_LIMIT, PRO_PLAN_PRICE_LABEL } from "@/lib/plan";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  const features = [
    { icon: QrCode, title: "QR code par équipement", text: "Étiquettes 50×30 mm à imprimer ; un scan affiche l'état de conformité." },
    { icon: BellRing, title: "Alertes automatiques", text: "E-mail récapitulatif à J-30, J-7, le jour J et en cas d'échéance dépassée." },
    { icon: FileCheck2, title: "Certificats centralisés", text: "Historique des étalonnages et maintenances avec PDF et photos." },
  ];
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2 font-semibold">
          <Gauge className="size-5" /> Registre Métrologie
        </span>
        <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
          Connexion
        </Link>
      </header>
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Le registre de vos équipements, étalonnages et maintenances
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Inventaire, échéances de métrologie, certificats et alertes : ne laissez plus passer un étalonnage.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Commencer gratuitement
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Gratuit jusqu&apos;à {FREE_PLAN_EQUIPMENT_LIMIT} équipements · Pro {PRO_PLAN_PRICE_LABEL}, illimité
        </p>
      </section>
      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-16 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border p-5">
            <f.icon className="mb-3 size-6" />
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
