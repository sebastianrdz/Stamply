"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@stamply/ui/logo";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { LanguageSelector } from "@stamply/i18n/language-selector";
import { useTranslations } from "@stamply/i18n/provider";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function Header() {
  const { landing } = useTranslations();
  const { nav } = landing;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const links = [
    { href: "/#como-funciona", label: nav.how },
    { href: "/#ejemplos", label: nav.examples },
    { href: "/#precios", label: nav.pricing },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const linkClass =
    "text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-150",
        scrolled || open
          ? "border-border bg-background/95"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <Logo />
        </Link>

        <nav aria-label={nav.primaryLabel} className="hidden items-center md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href={`${appUrl}/login`} className={linkClass}>
            {nav.signIn}
          </Link>
          <Link
            href={`${appUrl}/register`}
            className={buttonVariants({ size: "md" })}
          >
            {nav.getStarted}
          </Link>
          {/* <LanguageSelector /> */}
        </div>

        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? nav.closeMenu : nav.openMenu}
          onClick={() => setOpen((o) => !o)}
          className="hover:bg-muted focus-visible:ring-ring -mr-2 grid size-11 place-items-center rounded-lg focus-visible:ring-2 focus-visible:outline-none md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="px-6 pb-6 md:hidden">
          <nav aria-label={nav.primaryLabel} className="flex flex-col">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-border flex min-h-12 items-center border-b text-base font-medium"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-3">
            <Link
              href={`${appUrl}/register`}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              {nav.getStarted}
            </Link>
            <Link
              href={`${appUrl}/login`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full",
              )}
            >
              {nav.signIn}
            </Link>
            {/* <LanguageSelector className="self-start" /> */}
          </div>
        </div>
      )}
    </header>
  );
}
