import type { Locale } from "@stamply/i18n/config";

/**
 * Add-to-wallet links using the official, unaltered Apple/Google badge artwork
 * (per each provider's brand guidelines): the localized badge is rendered as a
 * fixed-aspect image inside the link. Apple returns a signed .pkpass; Google
 * redirects to a signed "Save to Google Wallet" URL.
 */
export function WalletButtons({
  token,
  locale,
  appleLabel,
  googleLabel,
}: {
  token: string;
  locale: Locale;
  appleLabel: string;
  googleLabel: string;
}) {
  const appleBadge =
    locale === "es" ? "/wallet-badges/apple-es.svg" : "/wallet-badges/apple-en.svg";
  const googleBadge =
    locale === "es"
      ? "/wallet-badges/google-es.svg"
      : "/wallet-badges/google-en.svg";

  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={`/api/wallet/apple/${token}`}
        aria-label={appleLabel}
        className="inline-block rounded-lg transition-opacity hover:opacity-90 focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- official brand artwork, rendered unaltered (no next/image optimization) */}
        <img src={appleBadge} alt={appleLabel} className="h-12 w-auto" />
      </a>
      <a
        href={`/api/wallet/google/${token}`}
        aria-label={googleLabel}
        className="inline-block rounded-full transition-opacity hover:opacity-90 focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- official brand artwork, rendered unaltered (no next/image optimization) */}
        <img src={googleBadge} alt={googleLabel} className="h-12 w-auto" />
      </a>
    </div>
  );
}
