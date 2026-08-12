import type { Metadata } from "next";
import { Trash2, X } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { currentCount } from "@/lib/billing/entitlements";
import { planLimit } from "@stamply/plans";
import { revokeInvitation, removeMembership } from "@/lib/team/actions";
import { isInviteExpired } from "@/lib/team/shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { InviteForm } from "./invite-form";
import { CopyInviteLink } from "./invite-link";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import type { Membership, Invitation } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.team.metaTitle };
}

export default async function TeamPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const business = membership.business;
  const supabase = await createClient();
  const dict = await getDictionary(await getLocale());

  const [{ data: members }, { data: invites }, count] = await Promise.all([
    supabase
      .from("memberships")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("*")
      .eq("business_id", business.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    currentCount(supabase, business.id, "employees"),
  ]);

  const limit = planLimit(business.plan, "employees");
  const atLimit = limit != null && count >= limit;

  return (
    <>
      <PageHeader
        title={dict.dashboard.team.title}
        description={dict.dashboard.team.description}
        action={
          <Badge variant={atLimit ? "accent" : "secondary"}>
            {limit == null
              ? interpolate(dict.dashboard.team.membersBadge, { count })
              : interpolate(dict.dashboard.team.membersBadgeWithLimit, {
                  count,
                  limit,
                })}
          </Badge>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{dict.dashboard.team.inviteCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {atLimit ? (
            <p className="text-muted-foreground text-sm">
              {dict.dashboard.team.atLimit}
            </p>
          ) : (
            <InviteForm />
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{dict.dashboard.team.membersCardTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {(members ?? []).map((m: Membership) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {m.email ?? dict.common.unknownEmail}
                </p>
                <Badge variant="muted" className="mt-0.5">
                  {dict.common.roles[m.role]}
                </Badge>
              </div>
              {m.role !== "owner" && (
                <form action={removeMembership.bind(null, m.id)}>
                  <button
                    type="submit"
                    aria-label={dict.dashboard.team.removeAria}
                    className="text-muted-foreground hover:text-destructive grid size-8 place-items-center rounded-lg transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {(invites ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{dict.dashboard.team.pendingInvitesCardTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {(invites ?? []).map((inv: Invitation) => {
              const expired = isInviteExpired(inv.expires_at);
              return (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inv.email}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge variant="muted">
                        {dict.common.roles[inv.role]}
                      </Badge>
                      {expired && (
                        <Badge variant="accent">
                          {dict.dashboard.team.expiredBadge}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!expired && <CopyInviteLink path={`/join/${inv.token}`} />}
                    <form action={revokeInvitation.bind(null, inv.id)}>
                      <button
                        type="submit"
                        aria-label={dict.dashboard.team.revokeAria}
                        className="text-muted-foreground hover:text-destructive grid size-8 place-items-center rounded-lg transition-colors"
                      >
                        <X className="size-4" />
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </>
  );
}
