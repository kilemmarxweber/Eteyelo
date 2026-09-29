import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { MessagingClient } from "@/lib/messaging-client";
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

async function sendOtpMessage(phoneE164: string, code: string) {
  const apiKey = process.env.MESSAGING_API_KEY?.trim();
  const baseUrl = process.env.MESSAGING_API_BASE_URL?.trim();
  // sms (défaut) | whatsapp | auto (SMS puis WA)
  const preferred =
    process.env.MESSAGING_OTP_CHANNEL?.trim().toLowerCase() || "sms";

  // Dev / CI : log le code si pas d'API messaging
  if (!apiKey) {
    console.info(
      `[mobile-otp] DEV code for ${maskPhone(phoneE164)}: ${code}`,
    );
    return { channel: "dev" as const };
  }

  const client = new MessagingClient({
    apiKey,
    baseUrl: baseUrl || undefined,
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

  if (preferred === "whatsapp") {
    await sendWhatsApp();
    return { channel: "whatsapp" as const };
  }

  if (preferred === "auto") {
    try {
      await sendSms();
      return { channel: "sms" as const };
    } catch (smsError) {
      console.warn("[mobile-otp] SMS failed, trying WhatsApp", smsError);
      await sendWhatsApp();
      return { channel: "whatsapp" as const };
    }
  }

  // Canal SMS forcé (défaut) — OTP par numéro de téléphone
  try {
    await sendSms();
    return { channel: "sms" as const };
  } catch (smsError) {
    const detail =
      smsError instanceof Error ? smsError.message : String(smsError);
    console.error("[mobile-otp] SMS send failed", detail);
    // En local (expose code), on continue pour préremplir l'OTP dans l'app
    if (shouldExposeOtpCode()) {
      console.warn("[mobile-otp] Fallback DEV après échec SMS");
      return { channel: "dev" as const };
    }
    throw new Error(
      "Impossible d'envoyer le SMS OTP. Vérifiez MESSAGING_API_KEY / MESSAGING_API_BASE_URL.",
    );
  }
}

function shouldExposeOtpCode() {
  // Jamais en production — même si MESSAGING_OTP_EXPOSE_CODE=true.
  if (process.env.NODE_ENV === "production") return false;
  const flag = process.env.MESSAGING_OTP_EXPOSE_CODE?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  // Dev : exposé par défaut (sauf opt-out), ou si flag explicite.
  return true;
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
      `[mobile-otp] DEV code for ${maskPhone(phoneE164)}: ${code} (channel=${delivery.channel})`,
    );
  }
  return {
    expiresAt: expiresAt.toISOString(),
    channel: delivery.channel,
    maskedPhone: maskPhone(phoneE164),
    // Préremplissage Flutter (MESSAGING_OTP_EXPOSE_CODE=true ou hors prod)
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
