import type { Metadata } from "next";
import { requireBusiness, getMemberships } from "@/lib/auth/session";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { LanguageSelector } from "@stamply/i18n/language-selector";
import { SettingsForm } from "./settings-form";
import { UserProfileForm } from "./user-profile-form";
import { DeleteBusinessForm } from "./delete-business-form";
import { DeleteAccountForm } from "./delete-account-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.settings.metaTitle };
}

export default async function SettingsPage() {
  const { user, membership } = await requireBusiness();
  const dict = await getDictionary(await getLocale());
  const canEditBusiness =
    membership.role === "owner" || membership.role === "admin";
  const isOwner = membership.role === "owner";
  const memberships = await getMemberships();
  const ownsBusiness = memberships.some((m) => m.role === "owner");
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  return (
    <>
      <PageHeader
        title={dict.dashboard.settings.title}
        description={
          canEditBusiness
            ? dict.dashboard.settings.description
            : dict.dashboard.settings.descriptionRestricted
        }
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{dict.dashboard.settings.userProfileCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <UserProfileForm email={user.email ?? ""} fullName={fullName} />
        </CardContent>
      </Card>
      {canEditBusiness && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {dict.dashboard.settings.businessProfileCardTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm business={membership.business} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{dict.settings.language.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {dict.settings.language.description}
          </p>
          <LanguageSelector />
        </CardContent>
      </Card>
      <Card className="border-destructive/30 mt-6">
        <CardHeader>
          <CardTitle>{dict.dashboard.settings.dangerZone.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isOwner && (
            <>
              <DeleteBusinessForm business={membership.business} />
              <div className="border-t border-border pt-4">
                <DeleteAccountForm ownsBusiness={ownsBusiness} />
              </div>
            </>
          )}
          {!isOwner && <DeleteAccountForm ownsBusiness={ownsBusiness} />}
        </CardContent>
      </Card>
    </>
  );
}
