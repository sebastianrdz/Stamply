import type { Metadata } from "next";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { LegalDocument } from "@/components/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return {
    title: dict.legal.nav.privacyTitle,
    alternates: {
      canonical: "/privacy",
      languages: { es: "/privacy", en: "/privacy", "x-default": "/privacy" },
    },
  };
}

export default async function PrivacyPage() {
  const dict = await getDictionary(await getLocale());

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <LegalDocument dict={dict} doc="privacy" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
