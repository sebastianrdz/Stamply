import { redirect } from "next/navigation";

/**
 * The app subdomain has no landing page — that lives on the marketing site
 * (apex domain). Send the root straight to the dashboard; the proxy will bounce
 * unauthenticated visitors to /login.
 */
export default function RootRedirect() {
  redirect("/dashboard");
}
