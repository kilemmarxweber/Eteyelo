"use server";

<<<<<<< HEAD
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ensureAcademicPeriodsForBranch } from "@/lib/academic-periods";
import {
  isManagedBranchType,
  type ManagedBranchType,
} from "@/lib/academic-structure";
import { ensureUniqueIdentifier, generateCode } from "@/lib/generated-identifiers";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import { ensureDefaultCreneaux } from "@/lib/default-creneaux";
import { ensureExtendedBranchStructure } from "@/lib/extended-branch-bootstrap";
=======
import { schoolRegistrationRequestSchema } from "@/app/components/inscription-ecole/schema";
import type { CreateBranchFormValues } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/schema";
import { sendSchoolRegistrationConfirmationEmail } from "@/lib/email/send-school-registration-confirmation-email";
import { schoolRegistrationRequestTemplate } from "@/lib/email/send-school-registration-request";
import { isSmtpConfigured, sendMail } from "@/lib/email/mailer";
>>>>>>> origin/main

const APP_NAME = process.env.APP_NAME ?? "Klambocore";
const DEFAULT_KLAMBOCORE_REQUEST_EMAIL = "kilem@klambocore.com";

export type BranchFormActionResult = {
  data: { id?: string; reference?: string } | null;
  error: string | null;
};

function generateRegistrationReference() {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

<<<<<<< HEAD
  if (!isManagedBranchType(data.typebranch)) {
    return {
      success: false,
      message: "Le type de branche est obligatoire.",
    };
  }

  const code = await ensureUniqueIdentifier({
    base: generateCode(data.name, "ECOLE"),
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.branch.findFirst({
          where: { organizationId: data.organizationId, code: value },
          select: { id: true },
        }),
      ),
  });

  const branch = await prisma.branch.create({
    data: {
      name: data.name,
      code,
      image: data.image || KLAMBOCORE_DEFAULT_IMAGE_PATH,
      adresse: data.adresse || null,
      ville: data.ville || null,
      pays: data.pays || "RDC",
      idnat: data.idnat || null,
      tel: data.tel || null,
      latitude: data.latitude,
      longitude: data.longitude,
      attendanceRadius: data.attendanceRadius || 100,
      organizationId: data.organizationId,
      typebranch: data.typebranch,
    },
    select: { id: true },
  });

  if (data.typebranch === "PRIMAIRE") {
    await ensurePrimaryAcademicStructure(prisma, branch.id);
  }

  await ensureExtendedBranchStructure(prisma, branch.id, data.typebranch);
  await ensureDefaultCreneaux(prisma, branch.id);

  await ensureAcademicPeriodsForBranch({
    branchId: branch.id,
    typebranch: data.typebranch,
  });

  revalidatePath("/inscription-ecole");
=======
  return `INS-${datePart}-${randomPart}`;
}
>>>>>>> origin/main

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
