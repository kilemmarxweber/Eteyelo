import { z } from "zod";
import {
  MESSAGING_MAX_BODY_LENGTH,
  MESSAGING_MAX_RECIPIENTS,
  MESSAGING_MAX_SUBJECT_LENGTH,
} from "@/lib/messaging/messaging-types";

const noSystemPrefix = (value: string) =>
  !/^(?:__CALL__:|__NOTIFY__:|__SATISFACTION__:)/i.test(value.trim());

/** Corps message (web + mobile) — refuse préfixes système. */
export const messagingBodySchema = z
  .string()
  .min(1)
  .max(MESSAGING_MAX_BODY_LENGTH + 50)
  .refine(noSystemPrefix, "Préfixe système non autorisé.");

export const messagingOptionalBodySchema = z
  .string()
  .max(MESSAGING_MAX_BODY_LENGTH + 50)
  .optional()
  .nullable()
  .refine(
    (value) => value == null || value === "" || noSystemPrefix(value),
    "Préfixe système non autorisé.",
  );

/** IDs stables (cuid / uuid) — refuse caractères bizarres. */
export const mobileIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Identifiant invalide.");

export const mobileClientMessageIdSchema = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-zA-Z0-9:_.-]+$/, "clientMessageId invalide.")
  .optional()
  .nullable();

export const mobileMessageBodySchema = messagingBodySchema;

export const mobileSendMessageSchema = z.object({
  body: mobileMessageBodySchema,
  replyToId: mobileIdSchema.optional().nullable(),
  clientMessageId: mobileClientMessageIdSchema,
});

export const mobileCreateConversationSchema = z.object({
  recipientIds: z
    .array(mobileIdSchema)
    .max(MESSAGING_MAX_RECIPIENTS)
    .default([]),
  body: messagingOptionalBodySchema,
  subject: z.string().max(MESSAGING_MAX_SUBJECT_LENGTH).optional().nullable(),
  clientMessageId: mobileClientMessageIdSchema,
  asGroup: z.boolean().optional(),
});

export const mobileEditMessageSchema = z.object({
  body: messagingBodySchema,
});

export const mobileConversationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read") }),
  z.object({ action: z.literal("unread") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("unarchive") }),
  z.object({ action: z.literal("delete") }),
  z.object({ action: z.literal("mute") }),
  z.object({ action: z.literal("unmute") }),
  z.object({ action: z.literal("lock_replies") }),
  z.object({ action: z.literal("unlock_replies") }),
  z.object({
    action: z.literal("set_role"),
    userId: mobileIdSchema,
    role: z.enum(["ADMIN", "MEMBER"]),
  }),
]);

export const mobileProfileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{M}\s'.-]+$/u, "Caractères non autorisés dans le nom.");

/** URL image : uniquement uploads locaux (pas de javascript:/http externe). */
export const mobileLocalUploadUrlSchema = z
  .string()
  .trim()
  .max(500)
  .regex(
    /^\/(?:api\/)?uploads\/[a-zA-Z0-9._%+-]+$/,
    "URL image non autorisée.",
  );

export const mobileMePatchJsonSchema = z
  .object({
    name: mobileProfileNameSchema.optional(),
    prenom: mobileProfileNameSchema.optional().nullable(),
    postnom: mobileProfileNameSchema.optional().nullable(),
    image: mobileLocalUploadUrlSchema.optional(),
    activeOrganizationId: mobileIdSchema.optional(),
  })
  .strict();

export function zodErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Données invalides.";
}
