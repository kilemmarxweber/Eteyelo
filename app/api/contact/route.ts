import { NextResponse } from "next/server";
import { z } from "zod";
import { isSmtpConfigured, sendMail } from "@/lib/email/mailer";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(3000),
  partnaire: z.string().trim().max(160).optional(),
});

export async function POST(request: Request) {
  const payload = contactSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Veuillez verifier les informations du formulaire." },
      { status: 400 },
    );
  }

  const recipient = process.env.MAIL_FROM || process.env.SMTP_USER;

  if (!recipient || !isSmtpConfigured()) {
    return NextResponse.json(
      { error: "La messagerie n'est pas configuree." },
      { status: 503 },
    );
  }

  const { name, email, phone, subject, message, partnaire } = payload.data;
  const text = [
    `Nom: ${name}`,
    `Email: ${email}`,
    phone ? `Telephone: ${phone}` : null,
    partnaire ? `Partenaire: ${partnaire}` : null,
    "",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  await sendMail({
    to: recipient,
    subject: `[Kalasa Edu] ${subject}`,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Nouveau message depuis Kalasa Edu</h2>
        <p><strong>Nom:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phone ? `<p><strong>Telephone:</strong> ${phone}</p>` : ""}
        ${partnaire ? `<p><strong>Partenaire:</strong> ${partnaire}</p>` : ""}
        <p><strong>Sujet:</strong> ${subject}</p>
        <p>${message.replace(/\n/g, "<br />")}</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
