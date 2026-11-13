"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@stamply/i18n/provider";
import { toast } from "@stamply/ui/toast";

/**
 * Fires the create/update/delete/welcome toast for `?created=1` / `?updated=1` /
 * `?deleted=1` (redirects in lib/programs/actions.ts) / `?welcome=1` (the plan
 * page, after checkout), then strips just those params via `router.replace` so back/forward nav doesn't refire
 * it. Rendered on both the programs list and program detail pages.
 */
function ProgramsToastListenerInner() {
  const dict = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const created = searchParams.has("created");
    const updated = searchParams.has("updated");
    const deleted = searchParams.has("deleted");
    const welcome = searchParams.has("welcome");
    if (!created && !updated && !deleted && !welcome) return;

    if (welcome) toast.success(dict.dashboard.toasts.businessCreated);
    else if (created) toast.success(dict.dashboard.toasts.programCreated);
    else if (updated) toast.success(dict.dashboard.toasts.programUpdated);
    else if (deleted) toast.success(dict.dashboard.toasts.programDeleted);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("created");
    params.delete("updated");
    params.delete("deleted");
    params.delete("welcome");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [searchParams, pathname, router, dict]);

  return null;
}

export function ProgramsToastListener() {
  return (
    <Suspense>
      <ProgramsToastListenerInner />
    </Suspense>
  );
}
