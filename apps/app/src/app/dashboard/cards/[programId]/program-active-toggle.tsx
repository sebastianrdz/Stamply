"use client";

import { useTransition } from "react";
import { toggleProgramActive } from "@/lib/programs/actions";
import { useTranslations } from "@stamply/i18n/provider";
import { Button } from "@stamply/ui/button";
import { toast } from "@stamply/ui/toast";

/**
 * Client wrapper around `toggleProgramActive` so a successful toggle can fire
 * a toast — the server action itself has no client to notify. Replaces the
 * old plain `<form action={toggleProgramActive.bind(...)}>` (no client JS);
 * markup/copy/variant are unchanged, only the submit mechanism moved to
 * `useTransition`.
 */
export function ProgramActiveToggle({
  programId,
  active,
}: {
  programId: string;
  active: boolean;
}) {
  const dict = useTranslations();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const nextActive = !active;
    startTransition(async () => {
      await toggleProgramActive(programId, nextActive);
      toast.success(
        nextActive
          ? dict.dashboard.toasts.programActivated
          : dict.dashboard.toasts.programDeactivated,
      );
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={handleClick}
    >
      {active
        ? dict.dashboard.programs.detail.disableCta
        : dict.dashboard.programs.detail.enableCta}
    </Button>
  );
}
