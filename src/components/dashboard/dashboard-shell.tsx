"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  close: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

/**
 * DashboardShell
 *
 * Owns the sidebar collapsed/expanded state and wires it to:
 *   - The collapsible sidebar panel (slides in/out on mobile; shrinks/expands on desktop)
 *   - A backdrop overlay on mobile when the sidebar is open
 *
 * Desktop:  sidebar is in the normal flex flow — when collapsed it hides via
 *           w-0/overflow-hidden so the main content expands to fill the gap.
 * Mobile:   sidebar slides in as a fixed overlay from the left; a backdrop
 *           captures clicks outside to close it.
 */
export function DashboardShell({
  sidebar,
  header,
  children,
}: {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  // Default open on desktop, closed on mobile (start collapsed = true means
  // sidebar hidden; we reverse: collapsed=false = sidebar visible).
  // We start with sidebar open everywhere and let CSS handle the initial mobile layout.
  const [collapsed, setCollapsed] = useState(false);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  const close = useCallback(() => setCollapsed(true), []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, close }}>
      <div className="flex h-svh flex-col overflow-hidden">
        {/* Global header */}
        {header}

        <div className="relative flex flex-1 overflow-hidden">
          {/* Mobile backdrop — shown only on small screens when sidebar is open */}
          {!collapsed && (
            <div
              className="bg-foreground/20 fixed inset-x-0 bottom-0 top-[57px] z-20 md:hidden"
              aria-hidden
              onClick={close}
            />
          )}

          {/*
           * Sidebar
           * Mobile: fixed, slides in from left via translate-x.
           *         z-30 so it's above the backdrop (z-20).
           * Desktop: sticky in flex flow, collapses to w-0 (overflow hidden).
           *          No translate — translate only kicks in on mobile.
           */}
          <div
            className={cn(
              // Shared
              "border-border bg-card flex shrink-0 flex-col border-r transition-all duration-200",
              // Desktop: collapse by shrinking width to 0
              collapsed ? "md:w-0 md:overflow-hidden" : "md:w-64",
              // Mobile: fixed overlay below the header, always w-64, slide in/out
              "fixed bottom-0 left-0 top-[57px] z-30 w-64 md:static md:z-auto",
              collapsed ? "-translate-x-full md:translate-x-0" : "translate-x-0",
            )}
          >
            {sidebar}
          </div>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-10 md:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
