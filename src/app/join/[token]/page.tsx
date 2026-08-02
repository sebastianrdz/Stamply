import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AcceptInvite } from "./accept-invite";
import { isInviteExpired } from "@/lib/team/shared";
import type { MembershipRole } from "@/types/database";

export const metadata: Metadata = { title: "Join a team" };

const roleLabel: Record<MembershipRole, string> = {
  owner: "Owner",
  admin: "Admin",
  employee: "Employee",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="p-6">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col gap-4 p-6">{children}</CardContent>
        </Card>
      </main>
    </div>
  );
}

export default async function JoinPage({
  params,
}: PageProps<"/join/[token]">) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Invite not found</h1>
        <p className="text-muted-foreground text-sm">
          This invite link is invalid or has been revoked. Ask whoever invited
          you for a new one.
        </p>
      </Shell>
    );
  }

  const { data: biz } = await admin
    .from("businesses")
    .select("name")
    .eq("id", invite.business_id)
    .single();
  const businessName = biz?.name ?? "this business";

  const expired = isInviteExpired(invite.expires_at);
  const used = Boolean(invite.accepted_at);

  if (used || expired) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">
          {used ? "Invite already used" : "Invite expired"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {used
            ? "This invite has already been accepted."
            : "This invite has expired. Ask for a new one."}
        </p>
      </Shell>
    );
  }

  const user = await getUser();
  const nextParam = encodeURIComponent(`/join/${token}`);

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">
          Join {businessName} on Stamply
        </h1>
        <p className="text-muted-foreground text-sm">
          You&apos;ve been invited as{" "}
          <Badge variant="muted">{roleLabel[invite.role]}</Badge> for{" "}
          <span className="font-medium">{invite.email}</span>.
        </p>
      </div>

      {!user ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            Sign in or create an account with {invite.email} to accept.
          </p>
          <Link
            href={`/login?next=${nextParam}`}
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            Sign in
          </Link>
          <Link
            href={`/register?next=${nextParam}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full",
            )}
          >
            Create an account
          </Link>
        </div>
      ) : (user.email ?? "").toLowerCase() !== invite.email.toLowerCase() ? (
        <div className="flex flex-col gap-2">
          <p className="text-destructive text-sm">
            You&apos;re signed in as {user.email}, but this invite is for{" "}
            {invite.email}.
          </p>
          <Link
            href={`/login?next=${nextParam}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full",
            )}
          >
            Sign in with a different account
          </Link>
        </div>
      ) : (
        <AcceptInvite token={token} businessName={businessName} />
      )}
    </Shell>
  );
}
