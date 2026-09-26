import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { listTeam } from "@/server/organizations";
import { AddMemberForm, MemberActions } from "./team-forms";

export const metadata: Metadata = { title: "Équipe" };

export default async function TeamPage() {
  const user = await requireUser("/team");
  const members = await listTeam(user);
  const manage = can(user.role, "team:manage");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Équipe · {user.orgName}</h1>
        <p className="text-sm text-muted-foreground">
          Administrateur : gestion complète · Technicien : équipements et interventions · Lecteur : consultation.
          Les alertes e-mail sont envoyées aux administrateurs et techniciens.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Membres ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">
                    {m.fullName ?? m.email} {m.id === user.userId && <span className="text-xs text-muted-foreground">(vous)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.email} · depuis le {formatDateFr(m.createdAt?.toISOString().slice(0, 10))}
                  </div>
                </div>
                {manage && m.id !== user.userId ? (
                  <MemberActions userId={m.id} role={m.role ?? "viewer"} />
                ) : (
                  <span className="text-sm">{ROLE_LABELS[m.role ?? "viewer"]}</span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {manage && (
        <Card>
          <CardHeader>
            <CardTitle>Ajouter un membre</CardTitle>
          </CardHeader>
          <CardContent>
            <AddMemberForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
