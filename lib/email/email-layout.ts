import { getKlambocoreEmailLogoSrc } from "./email-logo";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const DEFAULT_APP_NAME = process.env.APP_NAME ?? "Klambocore";

/** Domaine public affiché dans les emails transactionnels. */
export const KLAMBOCORE_LOGIN_URL = "https://klambocore.com";

export function getSignInUrl(path = "/auth/sign-in"): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    KLAMBOCORE_LOGIN_URL
  ).replace(/\/$/, "");

  // En local : toujours pointer vers klambocore.com dans les emails
  const publicBase =
    base.includes("localhost") || base.includes("127.0.0.1")
      ? KLAMBOCORE_LOGIN_URL
      : base;

  return `${publicBase}${path.startsWith("/") ? path : `/${path}`}`;
}

export type EmailBranchContact = {
  name?: string;
  phone?: string;
  address?: string;
};

export function getEmailContactInfo() {
  const name =
    process.env.CONTACT_NAME?.trim() ||
    process.env.APP_NAME?.trim() ||
    "Klambocore";
  const email =
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "contact@klambocore.com";
  const phone = process.env.CONTACT_PHONE?.trim() || "+243844952966";
  const logoUrl = getKlambocoreEmailLogoSrc();

  return { name, email, phone, logoUrl };
}

type EmailLayoutInput = {
  appName: string;
  title: string;
  intro: string;
  bodyHtml: string;
  cta?: { href: string; label: string };
  footerNote?: string;
  /** Infos établissement / branche affichées dans la signature. */
  branchContact?: EmailBranchContact;
};

function buildBranchSignatureHtml(branch?: EmailBranchContact): string {
  if (!branch?.name && !branch?.phone && !branch?.address) return "";

  const lines: string[] = [];
  if (branch.name) {
    lines.push(
      `<div style="font-weight:600;color:#334155;">${escapeHtml(branch.name)}</div>`,
    );
  }
  if (branch.phone) {
    lines.push(
      `<div><a href="tel:${escapeHtml(branch.phone)}" style="color:#64748b;text-decoration:none;">${escapeHtml(branch.phone)}</a></div>`,
    );
  }
  if (branch.address) {
    lines.push(`<div>${escapeHtml(branch.address)}</div>`);
  }

  return `
    <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">
      ${lines.join("")}
    </div>
  `;
}

function buildPlatformSignatureHtml(): string {
  const contact = getEmailContactInfo();
  return `
    <div style="font-size:10px;line-height:1.5;color:#94a3b8;">
      <div style="margin-bottom:2px;">
        Plateforme
        <a href="${KLAMBOCORE_LOGIN_URL}" style="color:#94a3b8;text-decoration:none;font-weight:600;">
          ${escapeHtml(contact.name)}
        </a>
      </div>
      <div>
        <a href="mailto:${escapeHtml(contact.email)}" style="color:#94a3b8;text-decoration:none;">
          ${escapeHtml(contact.email)}
        </a>
        &nbsp;·&nbsp;
        <a href="tel:${escapeHtml(contact.phone)}" style="color:#94a3b8;text-decoration:none;">
          ${escapeHtml(contact.phone)}
        </a>
      </div>
    </div>
  `;
}

/** Layout HTML partagé — même style que le mail de contact. */
export function emailLayoutHtml(input: EmailLayoutInput): string {
  const contact = getEmailContactInfo();
  const footer =
    input.footerNote ??
    `Email automatique envoyé depuis ${escapeHtml(input.appName)}.`;

  const ctaHtml = input.cta
    ? `
      <div style="margin-top:28px;">
        <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;background:#172554;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:bold;">
          ${escapeHtml(input.cta.label)}
        </a>
      </div>`
    : "";

  const branchSignature = buildBranchSignatureHtml(input.branchContact);
  const platformSignature = buildPlatformSignatureHtml();

  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;">
              
              <tr>
                <td style="background:#172554;padding:28px 32px;color:#ffffff;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        <img src="${escapeHtml(contact.logoUrl)}" alt="${escapeHtml(contact.name)}" width="48" height="48" style="display:block;border:0;border-radius:12px;background:#ffffff;max-width:48px;height:auto;" />
                      </td>
                      <td style="vertical-align:middle;padding-left:14px;">
                        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">
                          ${escapeHtml(input.appName)}
                        </div>
                        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;">
                          ${escapeHtml(input.title)}
                        </h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:28px 32px;">
                  <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
                    ${input.intro}
                  </p>

                  ${input.bodyHtml}

                  ${ctaHtml}
                </td>
              </tr>

              <tr>
                <td style="background:#f8fafc;padding:18px 32px;text-align:center;">
                  ${branchSignature}
                  ${platformSignature}
                  <div style="margin-top:10px;font-size:10px;color:#cbd5e1;">
                    ${footer}
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/** Carte d’infos (fond gris, coins arrondis) pour les détails clés. */
export function emailInfoCard(
  rows: Array<{ label: string; valueHtml: string }>,
): string {
  const items = rows
    .map(
      (row, index) => `
        <p style="margin:${index === 0 ? "0" : "10px"} 0 ${index === rows.length - 1 ? "0" : "10px"};font-size:14px;">
          <strong>${escapeHtml(row.label)} :</strong> ${row.valueHtml}
        </p>`,
    )
    .join("");

  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:24px;">
      ${items}
    </div>
  `;
}
