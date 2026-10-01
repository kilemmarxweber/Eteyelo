import { branchDocumentName } from "@/lib/branch-document-name";
import { findUserByTelephone } from "@/lib/mobile/session";
import { deliverSchoolNotify } from "@/lib/notify/deliver-school-notify";
import { schoolNotifyBotEmail } from "@/lib/notify/school-notify-bot";
import { prisma } from "@/lib/prisma";
import type { ParentFeedbackSource } from "@/prisma/generated/prisma/client";

const SATISFACTION_PREFIX = "__SATISFACTION__:";
const MIN_COMMENT_LENGTH = 5;

type SatisfactionItem = {
  parentId: string;
  branchId: string;
  branchName: string;
  schoolYearId: string;
  children: string[];
  status: "pending" | "done";
  rating?: number;
};

type SatisfactionPayload = {
  v: 1;
  month: number;
  year: number;
  label: string;
  items: SatisfactionItem[];
};

function monthLabel(month: number, year: number) {
  const labels = [
    "",
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];
  return `${labels[month] ?? month} ${year}`;
}

function serializePayload(payload: SatisfactionPayload) {
  return `${SATISFACTION_PREFIX}${JSON.stringify(payload)}`;
}

function parsePayload(body: string): SatisfactionPayload | null {
  const raw = body.trimStart();
  if (!raw.startsWith(SATISFACTION_PREFIX)) return null;
  try {
    const data = JSON.parse(raw.slice(SATISFACTION_PREFIX.length)) as SatisfactionPayload;
    if (!Array.isArray(data.items) || !data.month || !data.year) return null;
    return data;
  } catch {
    return null;
  }
}

function pickChildName(row: { prenom?: string | null; name?: string | null; postnom?: string | null }) {
  const value = [row.prenom, row.name, row.postnom].filter(Boolean).join(" ").trim();
  return value || "Élève";
}

export async function listPendingBranchesForUser(params: {
  userId: string;
  organizationId: string;
  month?: number;
  calendarYear?: number;
}) {
  const now = new Date();
  const month = params.month ?? now.getMonth() + 1;
  const calendarYear = params.calendarYear ?? now.getFullYear();

  const parents = await prisma.parent.findMany({
    where: {
      branchMember: {
        role: "PARENT",
        isActive: true,
        branch: {
          organizationId: params.organizationId,
          isActive: true,
        },
        member: {
          userId: params.userId,
          isArchived: false,
        },
      },
    },
    select: {
      id: true,
      branchMember: {
        select: {
          branchId: true,
          branch: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      },
      students: {
        select: {
          branchMember: {
            select: {
              member: {
                select: {
                  user: {
                    select: {
                      prenom: true,
                      name: true,
                      postnom: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const results: Array<
    SatisfactionItem & {
      hasFeedback: boolean;
      feedbackSource?: ParentFeedbackSource;
      feedbackId?: string;
    }
  > = [];

  for (const parent of parents) {
    const branchId = parent.branchMember?.branchId;
    if (!branchId) continue;
    const year = await prisma.schoolYear.findFirst({
      where: {
        branchId,
        isCurrentYear: true,
      },
      select: { id: true },
    });
    if (!year) continue;

    const existing = await prisma.parentFeedback.findFirst({
      where: {
        parentId: parent.id,
        branchId,
        schoolYearId: year.id,
        month,
      },
      select: {
        id: true,
        rating: true,
        source: true,
      },
    });

    results.push({
      parentId: parent.id,
      branchId,
      branchName: branchDocumentName(parent.branchMember.branch) || parent.branchMember.branch.name,
      schoolYearId: year.id,
      children: parent.students.map((student) =>
        pickChildName(student.branchMember?.member?.user ?? {}),
      ),
      status: existing ? "done" : "pending",
      ...(existing ? { rating: existing.rating } : {}),
      hasFeedback: Boolean(existing),
      feedbackSource: existing?.source,
      feedbackId: existing?.id,
    });
  }

  return {
    month,
    calendarYear,
    label: monthLabel(month, calendarYear),
    items: results,
    pendingItems: results.filter((row) => !row.hasFeedback),
  };
}

export async function submitParentSatisfaction(params: {
  userId: string;
  organizationId: string;
  branchId: string;
  rating: number;
  comment?: string | null;
  source?: ParentFeedbackSource;
}) {
  if (!Number.isFinite(params.rating) || params.rating < 1 || params.rating > 5) {
    return { error: "INVALID_RATING" as const };
  }
  const trimmedComment = params.comment?.trim() ?? "";
  if (params.rating <= 2 && trimmedComment.length < MIN_COMMENT_LENGTH) {
    return { error: "COMMENT_REQUIRED" as const };
  }

  const month = new Date().getMonth() + 1;
  const calendarYear = new Date().getFullYear();

  const parent = await prisma.parent.findFirst({
    where: {
      branchMember: {
        branchId: params.branchId,
        role: "PARENT",
        isActive: true,
        member: {
          userId: params.userId,
          organizationId: params.organizationId,
          isArchived: false,
        },
      },
    },
    select: {
      id: true,
    },
  });
  if (!parent) return { error: "PARENT_NOT_FOUND" as const };

  const currentYear = await prisma.schoolYear.findFirst({
    where: {
      branchId: params.branchId,
      isCurrentYear: true,
    },
    select: { id: true },
  });
  if (!currentYear) return { error: "NO_ACTIVE_SCHOOL_YEAR" as const };

  const existing = await prisma.parentFeedback.findFirst({
    where: {
      parentId: parent.id,
      branchId: params.branchId,
      schoolYearId: currentYear.id,
      month,
    },
    select: { id: true },
  });
  if (existing) return { error: "ALREADY_SUBMITTED" as const };

  const feedback = await prisma.parentFeedback.create({
    data: {
      parentId: parent.id,
      branchId: params.branchId,
      schoolYearId: currentYear.id,
      rating: params.rating,
      comment: trimmedComment || null,
      month,
      source: params.source ?? "WEB",
    },
  });

  await updateDispatchMessageAfterSubmit({
    userId: params.userId,
    organizationId: params.organizationId,
    branchId: params.branchId,
    month,
    calendarYear,
    rating: params.rating,
  });

  return { data: feedback };
}

async function updateDispatchMessageAfterSubmit(params: {
  userId: string;
  organizationId: string;
  branchId: string;
  month: number;
  calendarYear: number;
  rating: number;
}) {
  const dispatch = await prisma.parentSatisfactionDispatch.findUnique({
    where: {
      userId_organizationId_month_calendarYear: {
        userId: params.userId,
        organizationId: params.organizationId,
        month: params.month,
        calendarYear: params.calendarYear,
      },
    },
    select: {
      messageId: true,
      conversationId: true,
    },
  });
  if (!dispatch?.messageId || !dispatch.conversationId) return;

  const message = await prisma.message.findUnique({
    where: { id: dispatch.messageId },
    select: {
      id: true,
      body: true,
      conversationId: true,
    },
  });
  if (!message) return;
  const payload = parsePayload(message.body);
  if (!payload) return;

  let touched = false;
  payload.items = payload.items.map((item) => {
    if (item.branchId !== params.branchId || item.status === "done") return item;
    touched = true;
    return { ...item, status: "done", rating: params.rating };
  });
  if (!touched) return;

  await prisma.message.update({
    where: { id: message.id },
    data: {
      body: serializePayload(payload),
      editedAt: new Date(),
    },
  });
  await prisma.conversation.update({
    where: { id: message.conversationId },
    data: { updatedAt: new Date() },
  });

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: message.conversationId, leftAt: null },
    select: { userId: true },
  });

  const recipientUserIds = participants
    .map((row) => row.userId)
    .filter((id) => id !== params.userId);

  void import("@/lib/mobile/realtime").then(({ publishMobileEvent }) =>
    publishMobileEvent({
      type: "message.updated",
      organizationId: params.organizationId,
      conversationId: message.conversationId,
      messageId: message.id,
      senderId: params.userId,
      recipientUserIds,
    }),
  );
}

export async function ensureMonthlySatisfactionDispatchForUser(params: {
  userId: string;
  organizationId: string;
}) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const calendarYear = now.getFullYear();

  const already = await prisma.parentSatisfactionDispatch.findUnique({
    where: {
      userId_organizationId_month_calendarYear: {
        userId: params.userId,
        organizationId: params.organizationId,
        month,
        calendarYear,
      },
    },
    select: { id: true },
  });
  if (already) return { dispatched: false, reason: "already_dispatched" as const };

  const pending = await listPendingBranchesForUser({
    userId: params.userId,
    organizationId: params.organizationId,
    month,
    calendarYear,
  });
  if (pending.pendingItems.length === 0) {
    return { dispatched: false, reason: "nothing_pending" as const };
  }

  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: params.organizationId,
        userId: params.userId,
      },
    },
    select: {
      user: {
        select: {
          id: true,
          telephone: true,
          banned: true,
          statusUser: true,
        },
      },
    },
  });
  const phone = member?.user?.telephone?.trim();
  if (!phone || member.user.banned || member.user.statusUser === false) {
    return { dispatched: false, reason: "no_phone_or_inactive" as const };
  }
  const target = await findUserByTelephone(phone);
  if (!target || target.id !== params.userId) {
    return { dispatched: false, reason: "user_not_resolved" as const };
  }

  const richBody = serializePayload({
    v: 1,
    month,
    year: calendarYear,
    label: pending.label,
    items: pending.pendingItems.map((item) => ({
      parentId: item.parentId,
      branchId: item.branchId,
      branchName: item.branchName,
      schoolYearId: item.schoolYearId,
      children: item.children,
      status: "pending",
    })),
  });

  const sent = await deliverSchoolNotify({
    to: phone,
    organizationId: params.organizationId,
    parts: ["Votre avis mensuel est disponible sur Klambo."],
    richBody,
  });
  if (!sent.sent || sent.channel !== "klambo") {
    return { dispatched: false, reason: "delivery_failed" as const };
  }

  const bot = await prisma.user.findFirst({
    where: { email: schoolNotifyBotEmail(params.organizationId, null) },
    select: { id: true },
  });
  if (!bot) return { dispatched: false, reason: "bot_missing_after_send" as const };

  const conversation = await prisma.conversation.findFirst({
    where: {
      organizationId: params.organizationId,
      participants: {
        some: { userId: params.userId, leftAt: null },
      },
      AND: [
        {
          participants: {
            some: { userId: bot.id, leftAt: null },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!conversation) {
    return { dispatched: false, reason: "conversation_not_found" as const };
  }

  const convo = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  const messageId = convo?.messages[0]?.id ?? null;

  await prisma.parentSatisfactionDispatch.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId,
      month,
      calendarYear,
      conversationId: conversation.id,
      messageId,
    },
  });

  return {
    dispatched: true,
    conversationId: conversation.id,
    messageId,
  };
}

export async function dispatchMonthlyParentSatisfaction(params?: {
  organizationId?: string;
}) {
  const memberships = await prisma.member.findMany({
    where: {
      ...(params?.organizationId ? { organizationId: params.organizationId } : {}),
      isArchived: false,
      branchMember: {
        some: {
          role: "PARENT",
          isActive: true,
          branch: { isActive: true },
        },
      },
    },
    select: {
      userId: true,
      organizationId: true,
    },
    distinct: ["userId", "organizationId"],
  });

  let dispatched = 0;
  for (const item of memberships) {
    const result = await ensureMonthlySatisfactionDispatchForUser({
      userId: item.userId,
      organizationId: item.organizationId,
    });
    if (result.dispatched) dispatched += 1;
  }
  return {
    targets: memberships.length,
    dispatched,
  };
}
