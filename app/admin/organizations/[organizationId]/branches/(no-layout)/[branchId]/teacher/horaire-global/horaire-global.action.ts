"use server";

import { z } from "zod";
import { requireBranchAreaWriteContext } from "@/lib/auth/require-branch-context";
import { CYCLES } from "@/lib/cycle";
import { prisma } from "@/lib/prisma";
import { saveIssuedDocumentPdfBuffer } from "@/lib/issued-document-server";
import { resolveNotificationChannels } from "@/lib/notification-channels";
import { imageUrlToDataUrlServer } from "@/lib/reports/image-to-data-url.server";
import {
  buildLocalizedSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { action } from "@/lib/zsa";
import { resolveWhatsAppTo, sendTransactionalWhatsApp } from "@/lib/zindua";
import { getGlobalScheduleByCycleAction } from "../../schedule/schedule.action";
import {
  globalSchedulePdfFileName,
  globalSchedulePdfLabels,
  renderGlobalSchedulePdf,
} from "./export-global-schedule-pdf";
import { teacherSchedulePdfTable } from "./teacher-schedule-pdf-table";
import type { GlobalScheduleTeacher } from "./types";

function isAssignedTeacher(teacher: GlobalScheduleTeacher) {
  return Boolean(teacher.id) && !teacher.id.startsWith("unassigned:");
}

function publicOrigin() {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    "https://klambocore.com"
  ).replace(/\/$/, "");
  if (base.includes("localhost") || base.includes("127.0.0.1")) {
    return "https://klambocore.com";
  }
  return base;
}

function teacherPdfMeta(
  teacher: GlobalScheduleTeacher,
  labels: ReturnType<typeof globalSchedulePdfLabels>,
) {
  return `${teacher.classCount} ${labels.classes} · ${teacher.courseCount} ${labels.courses} · ${teacher.periodCount} ${labels.periods}`;
}

export const sendGlobalScheduleWhatsAppAction = action
  .input(
    z.object({
      cycle: z.enum(CYCLES),
      teacherIds: z.array(z.string().min(1)).min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { organizationId, branchId } =
      await requireBranchAreaWriteContext("schedule");

    const allow = await resolveNotificationChannels(
      organizationId,
      "teacherSchedule",
    );
    if (!allow.whatsapp) {
      throw new Error(
        "WhatsApp est désactivé pour l'horaire enseignants (Paramètres → Notifications).",
      );
    }

    const [schedule, err] = await getGlobalScheduleByCycleAction({
      cycle: input.cycle,
    });
    if (err || !schedule) {
      throw new Error("Impossible de charger l'horaire global.");
    }

    const requested = new Set(input.teacherIds);
    const teachers = schedule.teachers.filter(isAssignedTeacher);
    const targets = teachers.filter((teacher) => requested.has(teacher.id));

    if (targets.length === 0) {
      throw new Error("Aucun enseignant sélectionné dans cet horaire.");
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: schoolReportBranchSelect,
    });
    if (!branch) {
      throw new Error("Branche introuvable.");
    }

    const context = await buildLocalizedSchoolReportContext(branch);
    const labels = globalSchedulePdfLabels(context.locale);
    const logoDataUrl = await imageUrlToDataUrlServer(context.logoUrl);
    const schoolName = context.schoolName || "Établissement";
    const origin = publicOrigin();

    let sent = 0;
    let skippedNoContact = 0;
    let skippedNoSchedule = 0;
    let failed = 0;
    let error: string | undefined;
    let skipWhatsApp = false;

    for (const teacher of targets) {
      if (teacher.entries.length === 0) {
        skippedNoSchedule += 1;
        continue;
      }
      if (!resolveWhatsAppTo(teacher.telephone)) {
        skippedNoContact += 1;
        continue;
      }
      if (skipWhatsApp) {
        failed += 1;
        continue;
      }

      try {
        const pdfTitle = labels.title(schedule.cycleLabel);
        const doc = await renderGlobalSchedulePdf({
          context,
          title: pdfTitle,
          details: [labels.viewTeachers, teacher.name],
          hoursLabel: labels.hoursLabel,
          recreationLabel: labels.recreationLabel,
          yearLabel: labels.yearLabel,
          saturdayLabel: labels.saturdayLabel,
          tables: [
            teacherSchedulePdfTable(
              teacher,
              schedule,
              teacherPdfMeta(teacher, labels),
            ),
          ],
          logoDataUrl,
        });
        const buffer = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
        const saved = await saveIssuedDocumentPdfBuffer({
          buffer,
          baseName: globalSchedulePdfFileName(
            `${teacher.name}-${schedule.cycleLabel}`,
          ).replace(/\.pdf$/i, ""),
        });
        const pdfUrl = `${origin}${saved.url}`;

        const result = await sendTransactionalWhatsApp({
          to: teacher.telephone,
          organizationId,
          attachments: [{ url: pdfUrl, filename: saved.fileName }],
          parts: [
            schoolName,
            `Bonjour ${teacher.name},`,
            `voici le PDF de votre horaire ${schedule.cycleLabel}.`,
            `Télécharger : ${pdfUrl}`,
            `— ${schoolName}`,
          ],
        });

        if (result.sent) {
          sent += 1;
          continue;
        }

        failed += 1;
        if (!error && result.error) error = result.error;
        if (
          result.error?.includes("pas connecté") ||
          result.error?.includes("désactivé")
        ) {
          skipWhatsApp = true;
        }
      } catch (cause) {
        failed += 1;
        if (!error) {
          error =
            cause instanceof Error
              ? cause.message
              : "Impossible de générer le PDF de l'horaire.";
        }
      }
    }

    return {
      sent,
      skippedNoContact,
      skippedNoSchedule,
      failed,
      error: error ?? null,
    };
  });
