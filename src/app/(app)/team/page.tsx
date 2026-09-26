import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pageTitle } from "@/i18n/metadata";
import { getAppLocale } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getOrganization, listTeam } from "@/server/organizations";
import { AddMemberForm, MemberActions, OrgSettingsForm } from "./team-forms";

export const generateMetadata = pageTitle("team");

export default async function TeamPage() {
  const user = await requireUser("/team");
  const [members, org, t, locale] = await Promise.all([
    listTeam(user),
    getOrganization(user),
    getTranslations(),
    getAppLocale(),
  ]);
  const manage = can(user.role, "team:manage");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t("team.title", { org: user.orgName })}</h1>
        <p className="text-sm text-muted-foreground">{t("team.description")}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("team.members", { count: members.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">
                    {m.fullName ?? m.email}{" "}
                    {m.id === user.userId && <span className="text-xs text-muted-foreground">{t("common.you")}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.email} · {t("team.since", { date: formatDate(m.createdAt?.toISOString().slice(0, 10), locale) })}
                  </div>
                </div>
                {manage && m.id !== user.userId ? (
                  <MemberActions userId={m.id} role={m.role ?? "viewer"} />
                ) : (
                  <span className="text-sm">{t(`roles.${m.role ?? "viewer"}`)}</span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {manage && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("team.addMember")}</CardTitle>
            </CardHeader>
            <CardContent>
              <AddMemberForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("team.settings")}</CardTitle>
            </CardHeader>
            <CardContent>
              <OrgSettingsForm locale={org.locale} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
