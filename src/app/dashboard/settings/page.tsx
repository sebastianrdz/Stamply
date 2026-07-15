import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { membership } = await requireBusiness();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your business profile and card branding."
      />
      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm business={membership.business} />
        </CardContent>
      </Card>
    </>
  );
}
