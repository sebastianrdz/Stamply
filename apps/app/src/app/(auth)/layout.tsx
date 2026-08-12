import Link from "next/link";
import { Logo } from "@stamply/ui/logo";
import { marketingUrl } from "@/lib/urls";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="p-6">
        <Link href={marketingUrl()}>
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
