"use server";

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email/mailer";
import { contactSchema, type ContactInput } from "./schema";
import { contactMessageTemplate } from "@/lib/email/send-contact-message";

const APP_NAME = process.env.APP_NAME ?? "Klambocore";

type ContactActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function sendContactMessageAction(
  input: ContactInput,
): Promise<ContactActionResult> {
  const parsed = contactSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const data = parsed.data;

  let recipientEmail =
    process.env.CONTACT_EMAIL ||
    process.env.SMTP_USER ||
    "kilem@klambocore.com";

  if (data.recipientId) {
    const recipient = await prisma.user.findUnique({
      where: {
        id: data.recipientId,
      },
      select: {
        email: true,
        name: true,
      },
    });

    if (!recipient?.email) {
      return {
        ok: false,
        message: "Destinataire introuvable.",
      };
    }

    recipientEmail = recipient.email;
  }

  const subject = data.subject || "Demande de contact";

  const { text, html } = contactMessageTemplate({
    appName: APP_NAME,
    name: data.name,
    email: data.email,
    phone: data.phone,
    subject,
    message: data.message,
  });

  try {
    await sendMail({
      to: recipientEmail,
      subject,
      text,
      html,
    });

    return {
      ok: true,
      message: "Message envoyé.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer le message.",
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
