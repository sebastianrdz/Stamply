import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Start with Stamply
        </h1>
        <p className="text-muted-foreground text-sm">
          Create your account and set up your first loyalty card.
        </p>
      </div>
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}
