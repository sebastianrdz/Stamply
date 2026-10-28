import { requireBusiness } from "@/lib/auth/session";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { membership } = await requireBusiness();
  const dict = await getDictionary(await getLocale());
  const tabs = [
    { href: "/dashboard/settings", label: dict.nav.settingsGeneral, exact: true },
    ...(membership.role === "owner"
      ? [{ href: "/dashboard/settings/billing", label: dict.nav.settingsBilling }]
      : []),
  ];
  return (
    <>
      {tabs.length > 1 && <SettingsTabs tabs={tabs} />}
      {children}
    </>
  );
}
