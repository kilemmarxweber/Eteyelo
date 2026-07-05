type ContactMessageTemplateInput = {
  appName: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

export function contactMessageTemplate(input: ContactMessageTemplateInput) {
  const phone = input.phone || "Non renseigné";

  const text = [
    `Nouveau message depuis ${input.appName}`,
    "",
    `Sujet : ${input.subject}`,
    `Nom : ${input.name}`,
    `Email : ${input.email}`,
    `Téléphone : ${phone}`,
    "",
    "Message :",
    input.message,
  ].join("\n");

  const html = `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;">
              
              <tr>
                <td style="background:#172554;padding:28px 32px;color:#ffffff;">
                  <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">
                    ${escapeHtml(input.appName)}
                  </div>
                  <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">
                    Nouveau message de contact
                  </h1>
                </td>
              </tr>

              <tr>
                <td style="padding:28px 32px;">
                  <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
                    Vous avez reçu un nouveau message depuis le formulaire de contact.
                  </p>

                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:24px;">
                    <p style="margin:0 0 10px;font-size:14px;">
                      <strong>Sujet :</strong> ${escapeHtml(input.subject)}
                    </p>
                    <p style="margin:0 0 10px;font-size:14px;">
                      <strong>Nom :</strong> ${escapeHtml(input.name)}
                    </p>
                    <p style="margin:0 0 10px;font-size:14px;">
                      <strong>Email :</strong> 
                      <a href="mailto:${escapeHtml(input.email)}" style="color:#1d4ed8;text-decoration:none;">
                        ${escapeHtml(input.email)}
                      </a>
                    </p>
                    <p style="margin:0;font-size:14px;">
                      <strong>Téléphone :</strong> ${escapeHtml(phone)}
                    </p>
                  </div>

                  <div>
                    <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">
                      Message
                    </h2>
                    <div style="background:#ffffff;border-left:4px solid #172554;padding:14px 16px;color:#334155;font-size:15px;line-height:1.7;">
                      ${escapeHtml(input.message).replaceAll("\n", "<br />")}
                    </div>
                  </div>

                  <div style="margin-top:28px;">
                    <a href="mailto:${escapeHtml(input.email)}" style="display:inline-block;background:#172554;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:bold;">
                      Répondre au visiteur
                    </a>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background:#f8fafc;padding:18px 32px;color:#64748b;font-size:12px;text-align:center;">
                  Email automatique envoyé depuis ${escapeHtml(input.appName)}.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { text, html };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
