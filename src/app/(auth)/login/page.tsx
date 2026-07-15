import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to manage your loyalty programs.
        </p>
      </div>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
