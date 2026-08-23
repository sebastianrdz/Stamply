import type { Metadata } from "next";
import Link from "next/link";
import { ScanLine, Smartphone, Bell, MapPin } from "lucide-react";
import { Logo } from "@stamply/ui/logo";
import { buttonVariants } from "@stamply/ui/button";
import { Card, CardContent } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { LanguageSelector } from "@stamply/i18n/language-selector";
import { cn } from "@stamply/ui/utils";
import { PAID_PLANS } from "@stamply/plans";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { PricingPlans } from "./pricing-plans";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const marketingUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  const { seo } = dict;
  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: "/",
      languages: {
        es: "/",
        en: "/",
        "x-default": "/",
      },
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: "/",
      siteName: "Stamply",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
    },
  };
}

export default async function Home() {
  const dict = await getDictionary(await getLocale());
  const { landing } = dict;

  const features = [
    { icon: Smartphone, ...landing.features.wallet },
    { icon: ScanLine, ...landing.features.scan },
    { icon: Bell, ...landing.features.liveUpdates },
    { icon: MapPin, ...landing.features.nearby },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Stamply",
        url: marketingUrl.replace(/\/$/, ""),
      },
      {
        "@type": "Product",
        name: "Stamply",
        description:
          "Digital loyalty cards for cafés, barbershops, and restaurants.",
        offers: PAID_PLANS.map((plan) => ({
          "@type": "Offer",
          name: plan.name,
          price: plan.price,
          priceCurrency: "USD",
          url: `${appUrl}/register`,
        })),
      },
    ],
  };

  return (
    <div className="flex min-h-full flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <LanguageSelector className="mr-1" />
          <Link
            href={`${appUrl}/login`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {landing.nav.signIn}
          </Link>
          <Link href={`${appUrl}/register`} className={cn(buttonVariants({ size: "sm" }))}>
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
              href={`${appUrl}/register`}
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
          <PricingPlans appUrl={appUrl} />
        </section>
      </main>

      <footer className="border-border text-muted-foreground border-t px-6 py-8 text-center text-sm">
        <p>{landing.footer.rights}</p>
      </footer>
    </div>
  );
}
