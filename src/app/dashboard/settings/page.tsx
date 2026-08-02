import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";
import { UserProfileForm } from "./user-profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, membership } = await requireBusiness();
  const canEditBusiness =
    membership.role === "owner" || membership.role === "admin";
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          canEditBusiness
            ? "Your account, business profile, and card branding."
            : "Manage your account."
        }
      />
      <Card className={canEditBusiness ? "mb-6" : undefined}>
        <CardHeader>
          <CardTitle>User profile</CardTitle>
        </CardHeader>
        <CardContent>
          <UserProfileForm email={user.email ?? ""} fullName={fullName} />
        </CardContent>
      </Card>
      {canEditBusiness && (
        <Card>
          <CardHeader>
            <CardTitle>Business profile</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm business={membership.business} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
