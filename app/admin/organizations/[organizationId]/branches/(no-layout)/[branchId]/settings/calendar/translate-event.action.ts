"use server";

import { z } from "zod";
import type { EventLocaleCode } from "@/lib/calendar-event-i18n";

const inputSchema = z.object({
  title: z.string().optional().default(""),
  description: z.string().optional().default(""),
  targetLocale: z.enum(["en", "pt", "ln"]),
});

export type TranslateEventTextsResult = {
  title: string;
  description: string;
};

async function translateWithGoogle(text: string, targetLocale: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "fr");
  url.searchParams.set("tl", targetLocale);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", trimmed);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google translate HTTP ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw new Error("Reponse Google translate invalide");
  }

  return payload[0]
    .map((chunk) => (Array.isArray(chunk) ? String(chunk[0] ?? "") : ""))
    .join("")
    .trim();
}

async function translateWithMyMemory(text: string, targetLocale: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", trimmed.slice(0, 450));
  url.searchParams.set("langpair", `fr|${targetLocale}`);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`MyMemory HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };

  const translated = payload.responseData?.translatedText?.trim() ?? "";
  if (!translated || payload.responseStatus !== 200) {
    throw new Error("MyMemory n'a pas renvoye de traduction");
  }

  // MyMemory sometimes echoes "INVALID SOURCE LANGUAGE ..." etc.
  if (/INVALID|PLEASE SELECT/i.test(translated)) {
    throw new Error(translated);
  }

  return translated;
}

async function translateText(text: string, targetLocale: string) {
  try {
    return await translateWithGoogle(text, targetLocale);
  } catch {
    return translateWithMyMemory(text, targetLocale);
  }
}

export async function translateEventTextsAction(
  input: z.infer<typeof inputSchema>,
): Promise<TranslateEventTextsResult> {
  const data = inputSchema.parse(input);
  const title = data.title.trim();
  const description = data.description.trim();

  if (!title && !description) {
    return { title: "", description: "" };
  }

  try {
    const [translatedTitle, translatedDescription] = await Promise.all([
      translateText(title, data.targetLocale),
      translateText(description, data.targetLocale),
    ]);

    return {
      title: translatedTitle,
      description: translatedDescription,
    };
  } catch (error) {
    console.error("TRANSLATE_EVENT_ERROR", error);
    throw new Error(
      error instanceof Error
        ? `Traduction impossible: ${error.message}`
        : "Traduction impossible pour le moment.",
    );
  }
}
