import "server-only";

import * as React from "react";
import type { Locale } from "@stamply/i18n/config";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import type { MembershipRole } from "@/types/database";
import { emailFromAddress, getResendClient } from "./resend";
import { ResetPasswordEmail } from "./templates/reset-password-email";
import { TeamInviteEmail } from "./templates/team-invite-email";
import { VerifyEmail } from "./templates/verify-email";

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Shared send path for every transactional email. Never throws — a failed
 * send (network error, bad API key, Resend-reported error) always resolves
 * to `{ ok: false, error }` so callers (invite creation, signup, password
 * reset) can decide for themselves whether email failure should block the
 * underlying action. Errors are logged server-side for observability but
 * never include the recipient's token/OTP — only the generic Resend error.
 */
async function send(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}): Promise<SendResult> {
  try {
    const { error } = await getResendClient().emails.send({
      from: emailFromAddress(),
      to: params.to,
      subject: params.subject,
      react: params.react,
    });
    if (error) {
      console.error("[email] Resend reported an error sending", {
        to: params.to,
        subject: params.subject,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] send threw", {
      to: params.to,
      subject: params.subject,
      error: err instanceof Error ? err.message : err,
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}

export async function sendTeamInviteEmail(params: {
  to: string;
  businessName: string;
  role: MembershipRole;
  url: string;
  locale: Locale;
}): Promise<SendResult> {
  const dict = await getDictionary(params.locale);
  const copy = dict.email.teamInvite;
  const roleLabel = dict.common.roles[params.role];
  const vars = { business: params.businessName, role: roleLabel };

  return send({
    to: params.to,
    subject: interpolate(copy.subject, vars),
    react: React.createElement(TeamInviteEmail, {
      preview: interpolate(copy.preview, vars),
      heading: interpolate(copy.heading, vars),
      body: interpolate(copy.body, vars),
      cta: copy.cta,
      footer: copy.footer,
      url: params.url,
    }),
  });
}

export async function sendVerificationEmail(params: {
  to: string;
  url: string;
  locale: Locale;
}): Promise<SendResult> {
  const dict = await getDictionary(params.locale);
  const copy = dict.email.verify;

  return send({
    to: params.to,
    subject: copy.subject,
    react: React.createElement(VerifyEmail, {
      preview: copy.preview,
      heading: copy.heading,
      body: copy.body,
      cta: copy.cta,
      footer: copy.footer,
      url: params.url,
    }),
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  url: string;
  locale: Locale;
}): Promise<SendResult> {
  const dict = await getDictionary(params.locale);
  const copy = dict.email.passwordReset;

  return send({
    to: params.to,
    subject: copy.subject,
    react: React.createElement(ResetPasswordEmail, {
      preview: copy.preview,
      heading: copy.heading,
      body: copy.body,
      cta: copy.cta,
      footer: copy.footer,
      url: params.url,
    }),
  });
}
