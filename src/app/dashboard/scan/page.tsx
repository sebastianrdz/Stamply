import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Scan" };

export default async function ScanPage() {
  await requireBusiness();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Scan a card"
        description="Add a stamp or redeem a reward from the customer's QR."
      />
      <Scanner />
    </div>
  );
}
