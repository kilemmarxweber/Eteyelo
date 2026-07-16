import { clsx, type ClassValue } from "clsx";
import { FieldError } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
// IT APPEARS THAT BIG CALENDAR SHOWS THE LAST WEEK WHEN THE CURRENT DAY IS A WEEKEND.
// FOR THIS REASON WE'LL GET THE LAST WEEK AS THE REFERENCE WEEK.
// IN THE TUTORIAL WE'RE TAKING THE NEXT WEEK AS THE REFERENCE WEEK.

const getLatestMonday = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const latestMonday = today;
  latestMonday.setDate(today.getDate() - daysSinceMonday);
  return latestMonday;
};
export const adjustScheduleToCurrentWeek = (
  lessons: { title: string; start: Date; end: Date }[],
): { title: string; start: Date; end: Date }[] => {
  const latestMonday = getLatestMonday();

  return lessons.map((lesson) => {
    const lessonDayOfWeek = lesson.start.getDay();

    const daysFromMonday = lessonDayOfWeek === 0 ? 6 : lessonDayOfWeek - 1;

    const adjustedStartDate = new Date(latestMonday);

    adjustedStartDate.setDate(latestMonday.getDate() + daysFromMonday);
    adjustedStartDate.setHours(
      lesson.start.getHours(),
      lesson.start.getMinutes(),
      lesson.start.getSeconds(),
    );
    const adjustedEndDate = new Date(adjustedStartDate);
    adjustedEndDate.setHours(
      lesson.end.getHours(),
      lesson.end.getMinutes(),
      lesson.end.getSeconds(),
    );

    return {
      title: lesson.title,
      start: adjustedStartDate,
      end: adjustedEndDate,
    };
  });
};

// export function normalizeImageSrc(src?: string | null): string {
//   if (!src) return "/uploads/1752330108714.jpeg";
//   if (src.startsWith("http") || src.startsWith("data:")) return src;
//   return `/uploads/${src}`;
// }
export function normalizeImageSrc(src: unknown): string {
  const fallback = KLAMBOCORE_DEFAULT_IMAGE_PATH;

  if (!src) return fallback;

  // Cas normal
  if (typeof src === "string") {
    if (
      src.startsWith("http") ||
      src.startsWith("data:") ||
      src.startsWith("/")
    ) {
      return src;
    }

    return `/uploads/${src}`;
  }

  // Si on reçoit un tableau
  if (Array.isArray(src)) {
    return normalizeImageSrc(src[0]);
  }

  // Si on reçoit un objet { logo: ... }
  if (typeof src === "object") {
    const data = src as Record<string, unknown>;

    if (typeof data.logo === "string") {
      return normalizeImageSrc(data.logo);
    }

    // éventuellement prendre la première image disponible
    if (Array.isArray(data.ecole) && data.ecole.length) {
      return normalizeImageSrc(data.ecole[0]);
    }

    if (Array.isArray(data.event) && data.event.length) {
      return normalizeImageSrc(data.event[0]);
    }

    if (Array.isArray(data.gallery) && data.gallery.length) {
      return normalizeImageSrc(data.gallery[0]);
    }
  }

  return fallback;
}
export function normalizeError(error: unknown): FieldError | undefined {
  if (Array.isArray(error)) return undefined;
  return error as FieldError;
}
export function average(nums: number[]) {
  return nums.length
    ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)
    : 0;
}

export type BranchImages = {
  logo?: string;
  ecole: string[];
  event: string[];
  gallery: string[];
};

export function getBranchImage(value: unknown): BranchImages {
  const empty: BranchImages = {
    logo: undefined,
    ecole: [],
    event: [],
    gallery: [],
  };

  if (!value) return empty;

  let images = value;

  if (typeof value === "string") {
    try {
      images = JSON.parse(value);
    } catch {
      return empty;
    }
  }

  if (!images || typeof images !== "object") {
    return empty;
  }

  const data = images as Record<string, unknown>;

  return {
    logo:
      typeof data.logo === "string" ? normalizeImageSrc(data.logo) : undefined,

    ecole: Array.isArray(data.ecole)
      ? data.ecole.map((x) => normalizeImageSrc(String(x)))
      : [],

    event: Array.isArray(data.event)
      ? data.event.map((x) => normalizeImageSrc(String(x)))
      : [],

    gallery: Array.isArray(data.gallery)
      ? data.gallery.map((x) => normalizeImageSrc(String(x)))
      : [],
  };
}
