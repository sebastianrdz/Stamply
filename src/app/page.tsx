import Link from "next/link";
import { Check, ScanLine, Smartphone, Bell, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LanguageSelector } from "@/components/language-selector";
import { cn } from "@/lib/utils";
import { PAID_PLANS } from "@/lib/billing/plans";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function Home() {
  const dict = await getDictionary(await getLocale());
  const { landing } = dict;

  const features = [
    { icon: Smartphone, ...landing.features.wallet },
    { icon: ScanLine, ...landing.features.scan },
    { icon: Bell, ...landing.features.liveUpdates },
    { icon: MapPin, ...landing.features.nearby },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <LanguageSelector className="mr-1" />
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {landing.nav.signIn}
          </Link>
          <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
            {landing.nav.getStarted}
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <Badge variant="accent" className="mb-4">
            {landing.hero.badge}
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {landing.hero.title}
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg text-balance">
            {landing.hero.subtitle}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              {landing.hero.ctaPrimary}
            </Link>
            <Link
              href="#pricing"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              {landing.hero.ctaSecondary}
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
              {landing.pricing.heading}
            </h2>
            <p className="text-muted-foreground mt-2">
              {landing.pricing.subtitle}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PAID_PLANS.map((plan) => {
              const planCopy = dict.billing.plans[plan.tier];
              return (
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
                        <h3 className="text-lg font-semibold">
                          {planCopy.name}
                        </h3>
                        {plan.tier === "medium" && (
                          <Badge>{dict.billing.plans.mostPopular}</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {planCopy.tagline}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold tracking-tight">
                          ${plan.price}
                        </span>
                        <span className="text-muted-foreground">
                          {dict.common.perMonth}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {dict.common.billedMonthly}
                      </p>
                    </div>
                    <ul className="flex flex-col gap-2 text-sm">
                      {planCopy.features.map((f) => (
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
                          variant:
                            plan.tier === "medium" ? "primary" : "outline",
                        }),
                        "mt-auto w-full",
                      )}
                    >
                      {landing.pricing.cta}
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-border text-muted-foreground border-t px-6 py-8 text-center text-sm">
        <p>{landing.footer.rights}</p>
      </footer>
    </div>
  );
}
