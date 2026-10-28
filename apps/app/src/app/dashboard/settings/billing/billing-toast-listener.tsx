"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@stamply/i18n/provider";
import { toast } from "@stamply/ui/toast";

/**
 * Reads `?status=success|nochange|cancelled` (already set by the redirects in
 * lib/billing/actions.ts — that file is untouched) and fires the matching
 * toast: "success" is a celebration (`toast.success`), "nochange" is neutral
 * (plain `toast`, not `.success`), "cancelled" gets no toast at all. `status`
 * is always stripped via `router.replace` regardless of which branch fired.
 */
function BillingToastListenerInner() {
  const dict = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get("status");
    if (!status) return;

    if (status === "success") toast.success(dict.dashboard.toasts.billingSuccess);
    else if (status === "nochange") toast(dict.dashboard.toasts.billingNoChange);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [searchParams, pathname, router, dict]);

  return null;
}

export function BillingToastListener() {
  return (
    <Suspense>
      <BillingToastListenerInner />
    </Suspense>
  );
}
