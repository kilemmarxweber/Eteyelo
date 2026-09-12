export const NOTIFICATION_EVENT_KEYS = [
  "attendance",
  "results",
  "payment",
  "accountCreate",
  "profileUpdate",
  "passwordReset",
  "inscription",
  "communique",
  "calendarEvent",
  "invitation",
  "payroll",
  "emailVerification",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENT_KEYS)[number];

export type NotificationChannelFlags = {
  email: boolean;
  whatsapp: boolean;
};

export type NotificationChannelsMap = Record<
  NotificationEvent,
  NotificationChannelFlags
>;

export const DEFAULT_NOTIFICATION_CHANNEL: NotificationChannelFlags = {
  email: true,
  whatsapp: true,
};

export const NOTIFICATION_EVENT_META: Array<{
  key: NotificationEvent;
  label: string;
  hint: string;
  emailForced?: boolean;
  comingSoon?: boolean;
}> = [
  {
    key: "attendance",
    label: "Présences / absences",
    hint: "Absence, justification, acceptation, refus, retour.",
  },
  {
    key: "results",
    label: "Résultats scolaires",
    hint: "Bouton « Notifier les parents » sur les résultats.",
  },
  {
    key: "payment",
    label: "Paiement",
    hint: "Encaissement, modification ou annulation.",
  },
  {
    key: "accountCreate",
    label: "Création de compte",
    hint: "Identifiants temporaires (parent, élève, personnel).",
  },
  {
    key: "profileUpdate",
    label: "Modification de profil",
    hint: "Changement des informations du compte.",
  },
  {
    key: "passwordReset",
    label: "Réinitialisation du mot de passe",
    hint: "Nouveau mot de passe temporaire.",
  },
  {
    key: "inscription",
    label: "Inscription élève",
    hint: "Confirmation de demande d'inscription.",
  },
  {
    key: "communique",
    label: "Communiqué",
    hint: "Interrupteurs prêts ; l'envoi aux parents viendra ensuite.",
    comingSoon: true,
  },
  {
    key: "calendarEvent",
    label: "Événement calendrier",
    hint: "Interrupteurs prêts ; l'envoi aux parents viendra ensuite.",
    comingSoon: true,
  },
  {
    key: "invitation",
    label: "Invitation membre",
    hint: "Invitation à rejoindre l'organisation.",
  },
  {
    key: "payroll",
    label: "Paie",
    hint: "Retenue estimée liée à un événement de présence.",
  },
  {
    key: "emailVerification",
    label: "Vérification d'email",
    hint: "L'e-mail reste obligatoire pour activer le compte.",
    emailForced: true,
  },
];

export function emptyNotificationChannelsMap(): NotificationChannelsMap {
  return Object.fromEntries(
    NOTIFICATION_EVENT_KEYS.map((key) => [
      key,
      { ...DEFAULT_NOTIFICATION_CHANNEL },
    ]),
  ) as NotificationChannelsMap;
}

export function parseNotificationChannels(
  raw: unknown,
  options?: { notifyParentOnPayment?: boolean },
): NotificationChannelsMap {
  const map = emptyNotificationChannelsMap();
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;

  if (source) {
    for (const key of NOTIFICATION_EVENT_KEYS) {
      const row = source[key];
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const flags = row as { email?: unknown; whatsapp?: unknown };
      map[key] = {
        email: flags.email !== false,
        whatsapp: flags.whatsapp !== false,
      };
    }
  } else if (options?.notifyParentOnPayment === false) {
    map.payment = { email: false, whatsapp: false };
  }

  map.emailVerification.email = true;
  return map;
}

export function serializeNotificationChannels(
  input: NotificationChannelsMap,
): NotificationChannelsMap {
  const parsed = parseNotificationChannels(input);
  parsed.emailVerification.email = true;
  return parsed;
}
