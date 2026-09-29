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

  try {
    await client.send({
      to: phoneE164,
      channel: "sms",
      type: "text",
      text,
      queue_kind: "otp",
    });
    return { channel: "sms" as const };
  } catch (smsError) {
    console.warn("[mobile-otp] SMS failed, trying WhatsApp", smsError);
    await client.send({
      to: phoneE164,
      channel: "whatsapp",
      type: "text",
      text,
      queue_kind: "otp",
    });
    return { channel: "whatsapp" as const };
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
  return {
    expiresAt: expiresAt.toISOString(),
    channel: delivery.channel,
    maskedPhone: maskPhone(phoneE164),
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
