"use server";

import { schoolRegistrationRequestSchema } from "@/app/components/inscription-ecole/schema";
import type { CreateBranchFormValues } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/schema";
import { sendSchoolRegistrationConfirmationEmail } from "@/lib/email/send-school-registration-confirmation-email";
import { schoolRegistrationRequestTemplate } from "@/lib/email/send-school-registration-request";
import { isSmtpConfigured, sendMail } from "@/lib/email/mailer";

const APP_NAME = process.env.APP_NAME ?? "Klambocore";
const DEFAULT_KLAMBOCORE_REQUEST_EMAIL = "kilem@klambocore.com";

export type BranchFormActionResult = {
  data: { id?: string; reference?: string } | null;
  error: string | null;
};

function generateRegistrationReference() {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `INS-${datePart}-${randomPart}`;
}

function stripImages(values: CreateBranchFormValues) {
  return {
    ...values,
    image: {
      logo: "",
      event: [],
      gallery: [],
      ecole: [],
    },
  };
}

function getSchoolRegistrationRecipientEmail() {
  return (
    process.env.INSCRIPTION_ECOLE_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    DEFAULT_KLAMBOCORE_REQUEST_EMAIL
  );
}

export async function submitSchoolRegistrationRequestAction(
  _organizationId: string,
  values: CreateBranchFormValues & { contactEmail?: string },
): Promise<BranchFormActionResult> {
  const parsed = schoolRegistrationRequestSchema.safeParse(stripImages(values));

  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  if (!isSmtpConfigured()) {
    return {
      data: null,
      error:
        "L'envoi de la demande est temporairement indisponible. Veuillez contacter Klambocore directement.",
    };
  }

  const data = parsed.data;
  const reference = generateRegistrationReference();
  const recipientEmail = getSchoolRegistrationRecipientEmail();

  const { subject, text, html } = schoolRegistrationRequestTemplate({
    appName: APP_NAME,
    reference,
    name: data.name,
    code: data.code,
    typebranch: data.typebranch,
    idnat: data.idnat,
    tel: data.tel,
    contactEmail: data.contactEmail,
    adresse: data.adresse,
    commune: data.commune,
    ville: data.ville,
    province: data.province,
    pays: data.pays,
    latitude: data.latitude,
    longitude: data.longitude,
    attendanceRadius: data.attendanceRadius,
  });

  try {
    await sendMail({
      to: recipientEmail,
      subject,
      text,
      html,
      replyTo: data.contactEmail,
    });

    await sendSchoolRegistrationConfirmationEmail({
      appName: APP_NAME,
      to: data.contactEmail,
      schoolName: data.name,
      reference,
      typebranch: data.typebranch,
    });

    return {
      data: { reference },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer la demande pour le moment.",
    };
  }
}
