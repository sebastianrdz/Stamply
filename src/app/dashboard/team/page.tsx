import type { Metadata } from "next";
import { Trash2, X } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { currentCount } from "@/lib/billing/entitlements";
import { planLimit } from "@/lib/billing/plans";
import { revokeInvitation, removeMembership } from "@/lib/team/actions";
import { isInviteExpired } from "@/lib/team/shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";
import { CopyInviteLink } from "./invite-link";
import type { Membership, Invitation, MembershipRole } from "@/types/database";

export const metadata: Metadata = { title: "Team" };

const roleLabel: Record<MembershipRole, string> = {
  owner: "Owner",
  admin: "Admin",
  employee: "Employee",
};

export default async function TeamPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const business = membership.business;
  const supabase = await createClient();

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
        title="Team"
        description="Invite staff and manage who can access this business."
        action={
          <Badge variant={atLimit ? "accent" : "secondary"}>
            {count}
            {limit == null ? "" : ` / ${limit}`} members
          </Badge>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
        </CardHeader>
        <CardContent>
          {atLimit ? (
            <p className="text-muted-foreground text-sm">
              You&apos;ve reached your plan&apos;s member limit. Upgrade your
              plan to invite more.
            </p>
          ) : (
            <InviteForm />
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {(members ?? []).map((m: Membership) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {m.email ?? "Unknown email"}
                </p>
                <Badge variant="muted" className="mt-0.5">
                  {roleLabel[m.role]}
                </Badge>
              </div>
              {m.role !== "owner" && (
                <form action={removeMembership.bind(null, m.id)}>
                  <button
                    type="submit"
                    aria-label="Remove member"
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
            <CardTitle>Pending invites</CardTitle>
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
                      <Badge variant="muted">{roleLabel[inv.role]}</Badge>
                      {expired && <Badge variant="accent">Expired</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!expired && (
                      <CopyInviteLink path={`/join/${inv.token}`} />
                    )}
                    <form action={revokeInvitation.bind(null, inv.id)}>
                      <button
                        type="submit"
                        aria-label="Revoke invite"
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
