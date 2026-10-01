import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  MessagingApiError,
  MessagingClient,
  MESSAGING_USER_MESSAGES,
} from "@/lib/messaging-client";
import { maskPhone } from "@/lib/mobile/phone";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_IDENTIFIER_PREFIX = "mobile-otp:";
const RATE_IDENTIFIER_PREFIX = "mobile-otp-rate:";
const MAX_REQUESTS_PER_HOUR = 8;

function otpIdentifier(phoneE164: string) {
  return `${OTP_IDENTIFIER_PREFIX}${phoneE164}`;
}

function rateIdentifier(phoneE164: string) {
  return `${RATE_IDENTIFIER_PREFIX}${phoneE164}`;
}

function generateCode() {
  return String(randomInt(100000, 999999));
}

async function countRecentOtpRequests(phoneE164: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.verification.count({
    where: {
      identifier: rateIdentifier(phoneE164),
      createdAt: { gte: since },
    },
  });
}

/**
 * Préremplissage app (devCode). Explicit true fonctionne aussi sous next start.
 * Couper : MESSAGING_OTP_EXPOSE_CODE=false
 */
function shouldExposeOtpCode() {
  const flag = process.env.MESSAGING_OTP_EXPOSE_CODE?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  return process.env.NODE_ENV !== "production";
}

function isNumberWithoutWhatsApp(error: unknown): error is MessagingApiError {
  return (
    error instanceof MessagingApiError &&
    (error.code === "WHATSAPP_NUMBER_INVALID" ||
      error.code === "INVALID_JID" ||
      error.status === 422)
  );
}

function failDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function sendOtpMessage(phoneE164: string, code: string) {
  const apiKey = process.env.MESSAGING_API_KEY?.trim();
  const baseUrl =
    process.env.MESSAGING_API_BASE_URL?.trim() ||
    "https://whatsapp-api.klambocore.com";
  // sms (défaut) | whatsapp | auto (SMS puis WA)
  const preferred =
    process.env.MESSAGING_OTP_CHANNEL?.trim().toLowerCase() || "sms";

  if (!apiKey) {
    console.info(
      `[mobile-otp] code for ${maskPhone(phoneE164)}: ${code} (channel=dev, no API key)`,
    );
    return { channel: "dev" as const };
  }

  const client = new MessagingClient({
    apiKey,
    baseUrl,
  });

  const text = `Klambo Messagerie : votre code est ${code}. Valide 5 minutes.`;

  const sendSms = () =>
    client.send({
      to: phoneE164,
      channel: "sms",
      type: "text",
      text,
      queue_kind: "otp",
    });

  const sendWhatsApp = () =>
    client.send({
      to: phoneE164,
      channel: "whatsapp",
      type: "text",
      text,
      queue_kind: "otp",
    });

  /** Même traitement pour SMS et WhatsApp : log + préremplissage, ou erreur claire. */
  const softFail = (detail: string, preferInvalidWaMessage = false) => {
    console.error(`[mobile-otp] send failed ${detail}`);
    if (shouldExposeOtpCode()) {
      console.warn(
        `[mobile-otp] Fallback app prefill for ${maskPhone(phoneE164)}: ${code}`,
      );
      return { channel: "dev" as const };
    }
    if (preferInvalidWaMessage) {
      throw new MessagingApiError(
        MESSAGING_USER_MESSAGES.numberNoWhatsApp,
        422,
        "WHATSAPP_NUMBER_INVALID",
      );
    }
    throw new Error(
      "Impossible d'envoyer le code. Réessayez dans un instant.",
    );
  };

  if (preferred === "whatsapp") {
    try {
      await sendWhatsApp();
      return { channel: "whatsapp" as const };
    } catch (waError) {
      // Pas WhatsApp → tenter SMS avant de abandonner
      if (isNumberWithoutWhatsApp(waError)) {
        console.warn(
          `[mobile-otp] ${MESSAGING_USER_MESSAGES.numberNoWhatsApp} → SMS`,
        );
        try {
          await sendSms();
          return { channel: "sms" as const };
        } catch (smsError) {
          return softFail(failDetail(smsError), true);
        }
      }
      return softFail(failDetail(waError));
    }
  }

  if (preferred === "auto") {
    try {
      await sendSms();
      return { channel: "sms" as const };
    } catch (smsError) {
      console.warn("[mobile-otp] SMS failed, trying WhatsApp", smsError);
      try {
        await sendWhatsApp();
        return { channel: "whatsapp" as const };
      } catch (waError) {
        return softFail(
          failDetail(waError),
          isNumberWithoutWhatsApp(waError),
        );
      }
    }
  }

  // Canal SMS forcé (défaut)
  try {
    await sendSms();
    return { channel: "sms" as const };
  } catch (smsError) {
    return softFail(failDetail(smsError));
  }
}

export async function requestMobileOtp(phoneE164: string) {
  const recent = await countRecentOtpRequests(phoneE164);
  if (recent >= MAX_REQUESTS_PER_HOUR) {
    throw new Error("Trop de demandes. Réessayez plus tard.");
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const id = crypto.randomUUID();
  const rateId = crypto.randomUUID();

  await prisma.verification.deleteMany({
    where: { identifier: otpIdentifier(phoneE164) },
  });

  await prisma.verification.createMany({
    data: [
      {
        id,
        identifier: otpIdentifier(phoneE164),
        value: code,
        expiresAt,
      },
      {
        id: rateId,
        identifier: rateIdentifier(phoneE164),
        value: "1",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    ],
  });

  const delivery = await sendOtpMessage(phoneE164, code);
  const exposeDevCode = shouldExposeOtpCode();
  if (exposeDevCode) {
    console.info(
      `[mobile-otp] code for ${maskPhone(phoneE164)}: ${code} (channel=${delivery.channel})`,
    );
  }
  return {
    expiresAt: expiresAt.toISOString(),
    channel: delivery.channel,
    maskedPhone: maskPhone(phoneE164),
    ...(exposeDevCode ? { devCode: code } : {}),
  };
}

export async function verifyMobileOtp(phoneE164: string, code: string) {
  const row = await prisma.verification.findFirst({
    where: {
      identifier: otpIdentifier(phoneE164),
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!row || row.value !== code.trim()) {
    throw new Error("Code incorrect ou expiré.");
  }

  await prisma.verification.deleteMany({
    where: { identifier: otpIdentifier(phoneE164) },
  });

  return true;
}
