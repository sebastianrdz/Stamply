import Link from "next/link";
import { Check, ScanLine, Smartphone, Bell, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PAID_PLANS } from "@/lib/billing/plans";

const features = [
  {
    icon: Smartphone,
    title: "Apple & Google Wallet",
    body: "Customers add their card to the wallet they already use. No app to install.",
  },
  {
    icon: ScanLine,
    title: "Scan to stamp",
    body: "Staff scan the customer's QR from any phone or tablet — right in the browser.",
  },
  {
    icon: Bell,
    title: "Live updates",
    body: "Stamps and rewards update on the wallet card instantly via push.",
  },
  {
    icon: MapPin,
    title: "Nearby reminders",
    body: "The card surfaces on the lock screen when a customer is near your shop.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Sign in
          </Link>
          <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <Badge variant="accent" className="mb-4">
            Digital loyalty, done right
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Turn one-time visitors into regulars.
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg text-balance">
            Stamply gives cafés, barbershops, and restaurants digital loyalty
            cards in Apple Wallet and Google Wallet — with rewards your
            customers actually come back for.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Start free trial
            </Link>
            <Link
              href="#pricing"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              See pricing
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title}>
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="bg-primary/10 text-primary grid size-10 place-items-center rounded-lg">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground text-sm">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-5xl px-6 pb-24">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Simple, per-location pricing
            </h2>
            <p className="text-muted-foreground mt-2">
              Monthly subscriptions, billed monthly — cancel anytime. Start with
              a 14-day free trial, no card required.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PAID_PLANS.map((plan) => (
              <Card
                key={plan.tier}
                className={cn(
                  plan.tier === "medium" &&
                    "border-primary ring-primary shadow-md ring-1",
                )}
              >
                <CardContent className="flex h-full flex-col gap-5 p-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      {plan.tier === "medium" && <Badge>Most popular</Badge>}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {plan.tagline}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold tracking-tight">
                        ${plan.price}
                      </span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Billed monthly
                    </p>
                  </div>
                  <ul className="flex flex-col gap-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="text-success size-4 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({
                        variant: plan.tier === "medium" ? "primary" : "outline",
                      }),
                      "mt-auto w-full",
                    )}
                  >
                    Start free trial
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-border text-muted-foreground border-t px-6 py-8 text-center text-sm">
        <p>© 2026 Stamply. All rights reserved.</p>
      </footer>
    </div>
  );
}
