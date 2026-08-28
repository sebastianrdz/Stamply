import { requireBusiness, getMemberships } from "@/lib/auth/session";
import { DashboardNav } from "@/components/dashboard/nav";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import { PostHogIdentifyBridge } from "@/components/analytics/posthog-identify-bridge";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, membership } = await requireBusiness();
  const memberships = await getMemberships();

  const options = memberships.map((m) => ({
    id: m.business.id,
    name: m.business.name,
    plan: m.business.plan,
  }));

  const sidebar = (
    <>
      <div className="p-4">
        <BusinessSwitcher
          businesses={options}
          activeId={membership.business.id}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <DashboardNav role={membership.role} />
      </div>
    </>
  );

  return (
    <>
      <PostHogIdentifyBridge
        userId={user.id}
        businessId={membership.business.id}
        role={membership.role}
        plan={membership.business.plan}
      />
      <DashboardShell
        header={<DashboardHeader role={membership.role} />}
        sidebar={sidebar}
      >
        {children}
      </DashboardShell>
    </>
  );
}
