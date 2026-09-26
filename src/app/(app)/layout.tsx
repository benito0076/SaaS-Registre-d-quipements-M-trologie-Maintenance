import Link from "next/link";
import { Gauge, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = [
    { href: "/dashboard", label: "Inventaire" },
    { href: "/labels", label: "Étiquettes" },
    { href: "/team", label: "Équipe" },
    ...(can(user.role, "billing:manage") ? [{ href: "/billing", label: "Abonnement" }] : []),
  ];
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <header className="no-print sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Gauge className="size-5" />
            <span className="hidden sm:inline">Registre Métrologie</span>
          </Link>
          <AppNav links={links} />
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight md:block">
              <div className="font-medium">{user.orgName}</div>
              <div className="text-muted-foreground">
                {user.fullName ?? user.email} · {ROLE_LABELS[user.role]}
              </div>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Se déconnecter" title="Se déconnecter">
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
