import { Apple, Wallet } from "lucide-react";

/**
 * Add-to-wallet links. Apple returns a signed .pkpass (downloaded/added by
 * Safari); Google redirects to a signed "Save to Google Wallet" URL.
 */
export function WalletButtons({
  token,
  appleLabel,
  googleLabel,
}: {
  token: string;
  appleLabel: string;
  googleLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <a
        href={`/api/wallet/apple/${token}`}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-black px-4 font-medium text-white transition-opacity hover:opacity-90"
      >
        <Apple className="size-5" />
        {appleLabel}
      </a>
      <a
        href={`/api/wallet/google/${token}`}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#4285F4] px-4 font-medium text-white transition-opacity hover:opacity-90"
      >
        <Wallet className="size-5" />
        {googleLabel}
      </a>
    </div>
  );
}
