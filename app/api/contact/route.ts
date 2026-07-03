import { NextResponse } from "next/server";
import { z } from "zod";
import { isSmtpConfigured, sendMail } from "@/lib/email/mailer";
import { isPlatformSupportEmail, listPlatformSupportEmails } from "@/lib/support-team";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(3000),
  partnaire: z.string().trim().max(160).optional(),
  supportAgent: z.string().trim().max(120).optional(),
  recipientEmail: z.string().trim().email().max(160).optional(),
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  const payload = contactSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Veuillez verifier les informations du formulaire." },
      { status: 400 },
    );
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "La messagerie n'est pas configuree." },
      { status: 503 },
    );
  }

  const {
    name,
    email,
    phone,
    subject,
    message,
    partnaire,
    supportAgent,
    recipientEmail,
  } = payload.data;

  if (recipientEmail && !(await isPlatformSupportEmail(recipientEmail))) {
    return NextResponse.json(
      { error: "Destinataire support invalide." },
      { status: 400 },
    );
  }

  const platformEmails = await listPlatformSupportEmails();
  const recipients = recipientEmail
    ? recipientEmail
    : platformEmails.join(", ");

  if (!recipients) {
    return NextResponse.json(
      { error: "Aucun agent support plateforme configuré." },
      { status: 503 },
    );
  }

  const text = [
    `Nom: ${name}`,
    `Email: ${email}`,
    phone ? `Telephone: ${phone}` : null,
    partnaire ? `Partenaire: ${partnaire}` : null,
    supportAgent ? `Agent support: ${supportAgent}` : null,
    "",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = phone ? escapeHtml(phone) : "";
  const safePartnaire = partnaire ? escapeHtml(partnaire) : "";
  const safeSupportAgent = supportAgent ? escapeHtml(supportAgent) : "";
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  await sendMail({
    to: recipients,
    subject: `[Kalasa Edu] ${subject}`,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Nouveau message depuis Kalasa Edu</h2>
        <p><strong>Nom:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        ${phone ? `<p><strong>Telephone:</strong> ${safePhone}</p>` : ""}
        ${partnaire ? `<p><strong>Partenaire:</strong> ${safePartnaire}</p>` : ""}
        ${supportAgent ? `<p><strong>Agent support:</strong> ${safeSupportAgent}</p>` : ""}
        <p><strong>Sujet:</strong> ${safeSubject}</p>
        <p>${safeMessage}</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
