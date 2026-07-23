import { sendMail, isSmtpConfigured } from "./mailer";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
} from "./email-layout";
import { orgRoleLabel } from "@/lib/org-role-labels";

const APP_NAME = DEFAULT_APP_NAME;

function getAcceptInvitationUrl(invitationId: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  return `${base}/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`;
}

export async function sendOrganizationInvitationEmail(input: {
  to: string;
  invitationId: string;
  organizationName: string;
  role: string;
  inviterName?: string | null;
}): Promise<void> {
  const acceptUrl = getAcceptInvitationUrl(input.invitationId);
  const roleLabel = orgRoleLabel(input.role);
  const inviter = input.inviterName?.trim() || "Un administrateur";
  const subject = `${APP_NAME} — Invitation à rejoindre ${input.organizationName}`;
  const introText = `${inviter} vous invite à rejoindre ${input.organizationName} sur ${APP_NAME} en tant que ${roleLabel}.`;

  const text = [
    `Bonjour,`,
    "",
    introText,
    "",
    `Organisation : ${input.organizationName}`,
    `Rôle : ${roleLabel}`,
    "",
    `Accepter l’invitation : ${acceptUrl}`,
    "",
    "Si vous n’attendiez pas cette invitation, ignorez ce message.",
    "",
    `— L’équipe ${APP_NAME}`,
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      { label: "Organisation", valueHtml: escapeHtml(input.organizationName) },
      { label: "Rôle", valueHtml: escapeHtml(roleLabel) },
      { label: "Email", valueHtml: escapeHtml(input.to) },
    ])}
    <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#64748b;">
      Vous rejoindrez uniquement cette organisation. Aucune donnée d’une autre
      organisation ne sera partagée ni copiée.
    </p>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#64748b;">
      Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.
    </p>
  `;

  const html = emailLayoutHtml({
    appName: APP_NAME,
    title: "Invitation à rejoindre une organisation",
    intro: escapeHtml(introText),
    bodyHtml,
    cta: { href: acceptUrl, label: "Accepter l’invitation" },
  });

  if (isSmtpConfigured()) {
    try {
      await sendMail({ to: input.to, subject, text, html });
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Nodemailer: ${message}`);
    }
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(
      `[sendOrganizationInvitationEmail] to=${input.to} url=${acceptUrl}`,
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "[sendOrganizationInvitationEmail] SMTP non configuré : email non envoyé.",
  );
}
