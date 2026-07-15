import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
} from "./email-layout";

type ContactMessageTemplateInput = {
  appName?: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

export function contactMessageTemplate(input: ContactMessageTemplateInput) {
  const appName = input.appName ?? DEFAULT_APP_NAME;
  const phone = input.phone || "Non renseigné";

  const text = [
    `Nouveau message depuis ${appName}`,
    "",
    `Sujet : ${input.subject}`,
    `Nom : ${input.name}`,
    `Email : ${input.email}`,
    `Téléphone : ${phone}`,
    "",
    "Message :",
    input.message,
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      { label: "Sujet", valueHtml: escapeHtml(input.subject) },
      { label: "Nom", valueHtml: escapeHtml(input.name) },
      {
        label: "Email",
        valueHtml: `<a href="mailto:${escapeHtml(input.email)}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(input.email)}</a>`,
      },
      { label: "Téléphone", valueHtml: escapeHtml(phone) },
    ])}
    <div>
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">
        Message
      </h2>
      <div style="background:#ffffff;border-left:4px solid #172554;padding:14px 16px;color:#334155;font-size:15px;line-height:1.7;">
        ${escapeHtml(input.message).replaceAll("\n", "<br />")}
      </div>
    </div>
  `;

  const html = emailLayoutHtml({
    appName,
    title: "Nouveau message de contact",
    intro:
      "Vous avez reçu un nouveau message depuis le formulaire de contact.",
    bodyHtml,
    cta: {
      href: `mailto:${input.email}`,
      label: "Répondre au visiteur",
    },
  });

  return { text, html };
}
