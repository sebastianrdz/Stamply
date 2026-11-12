import type { Metadata } from "next";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const { guide } = await getDictionary(await getLocale());
  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: {
      canonical: "/guide",
      languages: { es: "/guide", en: "/guide", "x-default": "/guide" },
    },
  };
}

export default async function GuidePage() {
  const { guide } = await getDictionary(await getLocale());

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {guide.title}
          </h1>
          <p className="text-muted-foreground mt-6 text-lg">{guide.intro}</p>

          <nav
            aria-label={guide.tocLabel}
            className="mt-8 rounded-xl border p-4"
          >
            <p className="mb-2 text-sm font-medium">{guide.tocLabel}</p>
            <ol className="text-muted-foreground space-y-1 text-sm">
              {guide.sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#faq"
                  className="hover:text-foreground underline-offset-4 hover:underline"
                >
                  {guide.faqTitle}
                </a>
              </li>
            </ol>
          </nav>

          {guide.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="mt-12 mb-3 text-2xl font-bold tracking-tight">
                {s.heading}
              </h2>
              {s.body.split("\n\n").map((paragraph, i) => (
                <p key={i} className="text-muted-foreground mb-4">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <section id="faq" className="scroll-mt-24">
            <h2 className="mt-12 mb-3 text-2xl font-bold tracking-tight">
              {guide.faqTitle}
            </h2>
            <dl className="space-y-5">
              {guide.faq.map((item) => (
                <div key={item.q}>
                  <dt className="font-medium">{item.q}</dt>
                  <dd className="text-muted-foreground mt-1">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <a
            href={appUrl}
            className={cn(buttonVariants({ size: "lg" }), "mt-12")}
          >
            {guide.cta}
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
