"use client";

import { useState, useRef, useEffect } from "react";
import { Menu, User, LogOut } from "lucide-react";
import { Logo } from "@stamply/ui/logo";
import { Badge } from "@stamply/ui/badge";
import { useSidebar } from "./dashboard-shell";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@stamply/ui/utils";
import { useTranslations } from "@stamply/i18n/provider";
import type { MembershipRole } from "@/types/database";

function UserMenu({ role }: { role: MembershipRole }) {
  const dict = useTranslations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={dict.nav.userMenu}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-lg transition-colors",
          open && "bg-muted text-foreground",
        )}
      >
        <User className="size-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-popover absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border p-1 shadow-lg"
        >
          {/* Role indicator */}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-muted-foreground text-xs">
              {dict.nav.roleLabel}
            </span>
            <Badge variant="muted">{dict.common.roles[role]}</Badge>
          </div>

          <div className="border-border my-1 border-t" />

          {/* Sign out */}
          <form
            action={async () => {
              setOpen(false);
              await signOut();
            }}
          >
            <button
              role="menuitem"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              <LogOut className="size-4" />
              {dict.common.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function DashboardHeader({ role }: { role: MembershipRole }) {
  const { toggle } = useSidebar();
  const dict = useTranslations();

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 flex h-[57px] shrink-0 items-center gap-3 border-b px-4 backdrop-blur">
      {/* Left: toggle + logo */}
      <button
        onClick={toggle}
        aria-label={dict.nav.toggleSidebar}
        className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-lg transition-colors"
      >
        <Menu className="size-5" />
      </button>

      <Logo />

      {/* Right: user menu */}
      <div className="ml-auto">
        <UserMenu role={role} />
      </div>
    </header>
  );
}
