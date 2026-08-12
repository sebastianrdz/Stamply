import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { Logo } from "@stamply/ui/logo";
import { Card, CardContent } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { signOut } from "@/lib/auth/actions";
import { AcceptInvite } from "./accept-invite";
import { isInviteExpired } from "@/lib/team/shared";
import { marketingUrl } from "@/lib/urls";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.join.metaTitle };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="p-6">
        <Link href={marketingUrl()}>
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col gap-4 p-6">
            {children}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const dict = await getDictionary(await getLocale());

  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (inviteError) {
    // Never log `token` — it's the live invite secret that grants business
    // access. Log only that the lookup failed, plus the Supabase error.
    console.error("[join] invite lookup failed", inviteError);
    return (
      <Shell>
        <h1 className="text-lg font-semibold">{dict.join.error.title}</h1>
        <p className="text-muted-foreground text-sm">
          {dict.join.error.description}
        </p>
      </Shell>
    );
  }

  if (!invite) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">{dict.join.notFound.title}</h1>
        <p className="text-muted-foreground text-sm">
          {dict.join.notFound.description}
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
          {used ? dict.join.alreadyUsed.title : dict.join.expired.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {used
            ? dict.join.alreadyUsed.description
            : dict.join.expired.description}
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
          {interpolate(dict.join.title, { business: businessName })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {dict.join.invitedAs}{" "}
          <Badge variant="muted">{dict.common.roles[invite.role]}</Badge>{" "}
          {dict.join.invitedFor}{" "}
          <span className="font-medium">{invite.email}</span>.
        </p>
      </div>

      {!user ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            {interpolate(dict.join.signInOrCreate, { email: invite.email })}
          </p>
          <Link
            href={`/login?next=${nextParam}`}
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            {dict.join.signIn}
          </Link>
          <Link
            href={`/register?next=${nextParam}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full",
            )}
          >
            {dict.join.createAccount}
          </Link>
        </div>
      ) : (user.email ?? "").toLowerCase() !== invite.email.toLowerCase() ? (
        <div className="flex flex-col gap-2">
          <p className="text-destructive text-sm">
            {interpolate(dict.join.signedInAsDifferent, {
              email: user.email ?? "",
              inviteEmail: invite.email,
            })}
          </p>
          <form action={signOut.bind(null, `/join/${token}`)}>
            <button
              type="submit"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full",
              )}
            >
              {dict.join.signInDifferent}
            </button>
          </form>
        </div>
      ) : (
        <AcceptInvite token={token} businessName={businessName} />
      )}
    </Shell>
  );
}
