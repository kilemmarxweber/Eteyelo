import {
  intlLocaleFromUserLocale,
  normalizeUserLocale,
  type UserLocale,
} from "@/lib/user-locale";

export function documentLocaleFrom(value: unknown): UserLocale {
  return normalizeUserLocale(value);
}

export function intlLocaleFromUnknown(value: unknown): string {
  return intlLocaleFromUserLocale(documentLocaleFrom(value));
}

export function withDocumentLocale<T extends { locale?: UserLocale }>(
  context: T,
  locale: unknown,
): T {
  return { ...context, locale: documentLocaleFrom(locale) };
}

export type DocumentChromeLabels = {
  establishment: string;
  academicYear: string;
  generatedAt: string;
  page: string;
};

const CHROME: Record<UserLocale, DocumentChromeLabels> = {
  fr: {
    establishment: "Établissement",
    academicYear: "Année scolaire",
    generatedAt: "Généré le",
    page: "Page",
  },
  en: {
    establishment: "School",
    academicYear: "Academic year",
    generatedAt: "Generated on",
    page: "Page",
  },
  pt: {
    establishment: "Estabelecimento",
    academicYear: "Ano lectivo",
    generatedAt: "Gerado em",
    page: "Página",
  },
};

export function documentChrome(locale?: unknown): DocumentChromeLabels {
  return CHROME[documentLocaleFrom(locale)];
}

const WEEKDAYS: Record<
  UserLocale,
  Record<string, { long: string; short: string }>
> = {
  fr: {
    Lundi: { long: "Lundi", short: "Lun." },
    Mardi: { long: "Mardi", short: "Mar." },
    Mercredi: { long: "Mercredi", short: "Mer." },
    Jeudi: { long: "Jeudi", short: "Jeu." },
    Vendredi: { long: "Vendredi", short: "Ven." },
    Samedi: { long: "Samedi", short: "Sam." },
    Dimanche: { long: "Dimanche", short: "Dim." },
  },
  en: {
    Lundi: { long: "Monday", short: "Mon." },
    Mardi: { long: "Tuesday", short: "Tue." },
    Mercredi: { long: "Wednesday", short: "Wed." },
    Jeudi: { long: "Thursday", short: "Thu." },
    Vendredi: { long: "Friday", short: "Fri." },
    Samedi: { long: "Saturday", short: "Sat." },
    Dimanche: { long: "Sunday", short: "Sun." },
  },
  pt: {
    Lundi: { long: "Segunda-feira", short: "Seg." },
    Mardi: { long: "Terça-feira", short: "Ter." },
    Mercredi: { long: "Quarta-feira", short: "Qua." },
    Jeudi: { long: "Quinta-feira", short: "Qui." },
    Vendredi: { long: "Sexta-feira", short: "Sex." },
    Samedi: { long: "Sábado", short: "Sáb." },
    Dimanche: { long: "Domingo", short: "Dom." },
  },
};

export function weekdayLabel(day: string, locale?: unknown): string {
  return WEEKDAYS[documentLocaleFrom(locale)][day]?.long ?? day;
}

export function weekdayShortLabel(day: string, locale?: unknown): string {
  return WEEKDAYS[documentLocaleFrom(locale)][day]?.short ?? day;
}

const MONTHS: Record<UserLocale, string[]> = {
  fr: [
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
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  pt: [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ],
};

export function monthLabel(month: number, locale?: unknown): string {
  return MONTHS[documentLocaleFrom(locale)][month - 1] ?? String(month);
}

export function formatDocumentDate(
  date: Date,
  locale?: unknown,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(
    intlLocaleFromUnknown(locale),
    options ?? {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(date);
}

export function formatDocumentDateTime(value: string, locale?: unknown): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(intlLocaleFromUnknown(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
