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

const CYCLE_LABELS: Record<UserLocale, Record<string, string>> = {
  fr: {
    MATERNELLE: "Maternelle",
    PRIMAIRE: "Primaire",
    SECONDAIRE: "Secondaire",
    ATELIER: "Atelier",
    CENTRE_FORMATION: "Centre de formation",
    UNIVERSITE: "Université",
    MIXTE: "Mixte",
    PERSONNEL: "Personnel",
    AUTRE: "Autre",
  },
  en: {
    MATERNELLE: "Preschool",
    PRIMAIRE: "Primary",
    SECONDAIRE: "Secondary",
    ATELIER: "Workshop",
    CENTRE_FORMATION: "Training centre",
    UNIVERSITE: "University",
    MIXTE: "Mixed",
    PERSONNEL: "Staff",
    AUTRE: "Other",
  },
  pt: {
    MATERNELLE: "Maternal",
    PRIMAIRE: "Primário",
    SECONDAIRE: "Secundário",
    ATELIER: "Atelier",
    CENTRE_FORMATION: "Centro de formação",
    UNIVERSITE: "Universidade",
    MIXTE: "Misto",
    PERSONNEL: "Pessoal",
    AUTRE: "Outro",
  },
};

export function cycleDocumentLabel(cycle: string, locale?: unknown): string {
  return CYCLE_LABELS[documentLocaleFrom(locale)][cycle] ?? cycle;
}

const PAYROLL_STATUS: Record<UserLocale, Record<string, string>> = {
  fr: {
    DRAFT: "Brouillon",
    VALIDATED: "Validé",
    PAID: "Payé",
    CANCELLED: "Annulé",
  },
  en: {
    DRAFT: "Draft",
    VALIDATED: "Validated",
    PAID: "Paid",
    CANCELLED: "Cancelled",
  },
  pt: {
    DRAFT: "Rascunho",
    VALIDATED: "Validado",
    PAID: "Pago",
    CANCELLED: "Cancelado",
  },
};

export function payrollStatusLabel(status: string, locale?: unknown): string {
  return PAYROLL_STATUS[documentLocaleFrom(locale)][status] ?? status;
}

const PAYROLL_HEADERS: Record<UserLocale, string[]> = {
  fr: [
    "Agent",
    "Cycle / rôle",
    "Branche",
    "Classes",
    "Contrat",
    "Séances",
    "Brut",
    "Pertes",
    "Min. perdues",
    "Net",
    "Différence",
    "Bulletin",
  ],
  en: [
    "Staff",
    "Cycle / role",
    "Branch",
    "Classes",
    "Contract",
    "Sessions",
    "Gross",
    "Deductions",
    "Lost min.",
    "Net",
    "Difference",
    "Payslip",
  ],
  pt: [
    "Agente",
    "Ciclo / função",
    "Filial",
    "Turmas",
    "Contrato",
    "Sessões",
    "Bruto",
    "Descontos",
    "Min. perdidos",
    "Líquido",
    "Diferença",
    "Recibo",
  ],
};

export function payrollDocumentCopy(locale?: unknown) {
  const loc = documentLocaleFrom(locale);
  const chrome = documentChrome(loc);
  return {
    title:
      loc === "en"
        ? "Payslips"
        : loc === "pt"
          ? "Recibos de vencimento"
          : "Bulletins de paie",
    sheetName:
      loc === "en" ? "Payslips" : loc === "pt" ? "Recibos" : "Bulletins de paie",
    academicYear: chrome.academicYear,
    headers: PAYROLL_HEADERS[loc],
    draft:
      loc === "en" ? "draft" : loc === "pt" ? "rascunho" : "brouillon",
    validated:
      loc === "en" ? "validated" : loc === "pt" ? "validado" : "validé",
    paid: loc === "en" ? "paid" : loc === "pt" ? "pago" : "payé",
    slips:
      loc === "en" ? "payslip(s)" : loc === "pt" ? "recibo(s)" : "bulletin(s)",
  };
}
