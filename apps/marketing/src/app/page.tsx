import type { Metadata } from "next";
import Link from "next/link";
import { getImageProps } from "next/image";
import { Check } from "lucide-react";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { PAID_PLANS } from "@stamply/plans";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { FaqAccordion } from "@/components/landing/faq-accordion";
import { ProcessSwitcher, ExamplesSwitcher } from "@/components/landing/visual-switcher";
import { bruma, heroShowcase } from "@/components/landing/landing-data";
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

const container = "mx-auto w-full max-w-[1200px] px-6";
const section = "py-14 md:py-24";

export default async function Home() {
  const dict = await getDictionary(await getLocale());
  const { landing } = dict;

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
          priceCurrency: "MXN",
          url: `${appUrl}/register`,
        })),
      },
    ],
  };

  // Art direction: only the matching <source>/<img> variant is downloaded.
  // loading="eager" on the <img> fetches only the <source> the browser picks (no preload link, so no double download).
  const common = {
    sizes: "(min-width: 1024px) 660px, 224px",
    fetchPriority: "high" as const,
    loading: "eager" as const,
  };
  const {
    props: { srcSet: desktopSrcSet, sizes: desktopSizes },
  } = getImageProps({ ...common, src: heroShowcase, alt: landing.images.heroShowcase });
  const {
    props: heroImg,
  } = getImageProps({ ...common, src: bruma, alt: landing.images.bruma });

  return (
    <div className="flex min-h-full flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
      <Header />

      <main className="flex-1">
        {/* 1. Hero */}
        <section className={cn(container, "pt-10 pb-14 md:pt-16 md:pb-20")}>
          <div className="grid items-center gap-10 lg:grid-cols-[45fr_55fr] lg:gap-8">
            <div>
              <p className="text-primary text-sm font-semibold">
                {landing.hero.eyebrow}
              </p>
              <h1 className="mt-4 text-5xl leading-[1.05] font-bold tracking-tight text-balance md:text-6xl">
                {landing.hero.title}
              </h1>
              <p className="text-muted-foreground mt-5 max-w-xl text-lg text-pretty">
                {landing.hero.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href={`${appUrl}/register`}
                  className={buttonVariants({ size: "lg" })}
                >
                  {landing.hero.ctaPrimary}
                </Link>
                <Link
                  href="#como-funciona"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  {landing.hero.ctaSecondary}
                </Link>
              </div>
              <p className="text-muted-foreground mt-4 text-sm">
                {landing.hero.trial}
              </p>
            </div>
            <figure className="flex flex-col items-center">
              <picture>
                <source
                  media="(min-width: 1024px)"
                  srcSet={desktopSrcSet}
                  sizes={desktopSizes}
                />
                {/* eslint-disable-next-line jsx-a11y/alt-text -- props from getImageProps include alt */}
                <img
                  {...heroImg}
                  className="h-[26rem] w-auto lg:h-auto lg:w-full"
                  style={{ color: "transparent" }}
                />
              </picture>
            </figure>
          </div>
        </section>

        {/* Reassurance row */}
        <div className="border-border border-y">
          <ul
            aria-label={landing.trust.label}
            className={cn(
              container,
              "flex flex-col gap-3 py-5 text-sm font-medium sm:flex-row sm:justify-between",
            )}
          >
            {landing.trust.items.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="text-primary size-4 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Cómo funciona */}
        <section
          id="como-funciona"
          aria-labelledby="how-title"
          className={cn(container, section)}
        >
          <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-16">
            <div>
              <h2
                id="how-title"
                className="text-3xl font-bold tracking-tight text-balance md:text-4xl"
              >
                {landing.how.title}
              </h2>
              <ol className="mt-8 flex flex-col gap-6">
                {landing.how.steps.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span
                      aria-hidden
                      className="text-primary w-6 shrink-0 text-lg font-semibold tabular-nums"
                    >
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-muted-foreground mt-1">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <ProcessSwitcher />
          </div>
        </section>

        {/* 3. Ejemplos */}
        <section
          id="ejemplos"
          aria-labelledby="examples-title"
          className={cn("bg-card border-border border-y", section)}
        >
          <div className={container}>
            <div className="mb-10 max-w-2xl">
              <h2
                id="examples-title"
                className="text-3xl font-bold tracking-tight text-balance md:text-4xl"
              >
                {landing.examples.title}
              </h2>
              <p className="text-muted-foreground mt-3 text-lg">
                {landing.examples.subtitle}
              </p>
            </div>
            <ExamplesSwitcher />
          </div>
        </section>

        {/* 4. Precios */}
        <section
          id="precios"
          aria-labelledby="pricing-title"
          className={cn(container, section)}
        >
          <div className="mb-10 text-center">
            <h2
              id="pricing-title"
              className="text-3xl font-bold tracking-tight text-balance md:text-4xl"
            >
              {landing.pricing.title}
            </h2>
            <p className="text-muted-foreground mt-3 text-lg">
              {landing.pricing.subtitle}
            </p>
          </div>
          <PricingPlans appUrl={appUrl} />
        </section>

        {/* 5. FAQ */}
        <section
          id="faq"
          aria-labelledby="faq-title"
          className={cn(container, "pb-14 md:pb-24")}
        >
          <div className="grid gap-8 lg:grid-cols-[4fr_8fr] lg:gap-16">
            <h2
              id="faq-title"
              className="text-3xl font-bold tracking-tight text-balance md:text-4xl"
            >
              {landing.faq.title}
            </h2>
            <FaqAccordion items={landing.faq.items} />
          </div>
        </section>

        {/* Closing CTA */}
        <section className={cn(container, "pb-14 md:pb-24")}>
          <div className="bg-foreground text-background flex flex-col items-start justify-between gap-6 rounded-2xl p-8 md:flex-row md:items-center md:p-12">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-balance md:text-3xl">
                {landing.cta.title}
              </h2>
              <p className="mt-2 opacity-80">{landing.cta.body}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href={`${appUrl}/register`}
                className={buttonVariants({ size: "lg" })}
              >
                {landing.cta.button}
              </Link>
              <p className="text-sm opacity-80">{landing.cta.trial}</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
