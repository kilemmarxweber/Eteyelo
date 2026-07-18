import type { ManagedBranchType } from "@/lib/academic-structure";
import { getBranchTypeLabel } from "@/lib/branch-capabilities";
import {
  DEFAULT_APP_NAME,
  emailInfoCard,
  emailLayoutHtml,
  escapeHtml,
} from "./email-layout";

export type SchoolRegistrationRequestInput = {
  appName?: string;
  reference: string;
  name: string;
  code?: string;
  typebranch: ManagedBranchType;
  idnat?: string;
  tel?: string;
  contactEmail?: string;
  adresse?: string;
  commune?: string;
  ville?: string;
  province?: string;
  pays?: string;
  latitude: number;
  longitude: number;
  attendanceRadius: number;
};

function formatBranchType(type: ManagedBranchType) {
  return getBranchTypeLabel(type);
}

function displayValue(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return "Non renseigné";
  }

  return String(value);
}

export function schoolRegistrationRequestTemplate(
  input: SchoolRegistrationRequestInput,
) {
  const appName = input.appName ?? DEFAULT_APP_NAME;
  const branchType = formatBranchType(input.typebranch);
  const mapsUrl = `https://www.google.com/maps?q=${input.latitude},${input.longitude}`;

  const text = [
    `Nouvelle demande de création d'établissement — ${appName}`,
    "",
    `Référence : ${input.reference}`,
    "",
    "— Établissement demandé —",
    `Nom : ${input.name}`,
    `Code : ${displayValue(input.code)}`,
    `Type : ${branchType}`,
    `ID NAT : ${displayValue(input.idnat)}`,
    `Téléphone : ${displayValue(input.tel)}`,
    `Email de contact : ${displayValue(input.contactEmail)}`,
    "",
    "— Localisation —",
    `Adresse : ${displayValue(input.adresse)}`,
    `Commune : ${displayValue(input.commune)}`,
    `Ville : ${displayValue(input.ville)}`,
    `Province : ${displayValue(input.province)}`,
    `Pays : ${displayValue(input.pays)}`,
    "",
    "— Géolocalisation —",
    `Latitude : ${input.latitude}`,
    `Longitude : ${input.longitude}`,
    `Rayon de présence : ${input.attendanceRadius} m`,
    `Carte : ${mapsUrl}`,
  ].join("\n");

  const bodyHtml = `
    ${emailInfoCard([
      { label: "Référence", valueHtml: escapeHtml(input.reference) },
      { label: "Nom de l'établissement", valueHtml: escapeHtml(input.name) },
      {
        label: "Code",
        valueHtml: escapeHtml(displayValue(input.code)),
      },
      { label: "Type", valueHtml: escapeHtml(branchType) },
      {
        label: "ID NAT",
        valueHtml: escapeHtml(displayValue(input.idnat)),
      },
      {
        label: "Téléphone",
        valueHtml: escapeHtml(displayValue(input.tel)),
      },
      {
        label: "Email de contact",
        valueHtml: input.contactEmail
          ? `<a href="mailto:${escapeHtml(input.contactEmail)}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(input.contactEmail)}</a>`
          : escapeHtml(displayValue(input.contactEmail)),
      },
    ])}
    ${emailInfoCard([
      {
        label: "Adresse",
        valueHtml: escapeHtml(displayValue(input.adresse)),
      },
      {
        label: "Commune",
        valueHtml: escapeHtml(displayValue(input.commune)),
      },
      { label: "Ville", valueHtml: escapeHtml(displayValue(input.ville)) },
      {
        label: "Province",
        valueHtml: escapeHtml(displayValue(input.province)),
      },
      { label: "Pays", valueHtml: escapeHtml(displayValue(input.pays)) },
    ])}
    ${emailInfoCard([
      {
        label: "Latitude",
        valueHtml: escapeHtml(String(input.latitude)),
      },
      {
        label: "Longitude",
        valueHtml: escapeHtml(String(input.longitude)),
      },
      {
        label: "Rayon de présence",
        valueHtml: escapeHtml(`${input.attendanceRadius} m`),
      },
      {
        label: "Carte",
        valueHtml: `<a href="${escapeHtml(mapsUrl)}" style="color:#1d4ed8;text-decoration:none;">Voir sur Google Maps</a>`,
      },
    ])}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
      Cette demande provient du formulaire public de création d'établissement.
      Les images ne sont pas jointes : seules les informations saisies ont été
      transmises pour examen et validation par Klambocore.
    </p>
  `;

  const html = emailLayoutHtml({
    appName,
    title: "Demande de création d'établissement",
    intro:
      "Une nouvelle demande de création d'établissement a été soumise via le site public. Veuillez examiner les informations ci-dessous avant de créer la fiche sur la plateforme.",
    bodyHtml,
    cta: input.contactEmail
      ? {
          href: `mailto:${input.contactEmail}`,
          label: "Contacter le demandeur",
        }
      : {
          href: mapsUrl,
          label: "Ouvrir la localisation",
        },
  });

  return {
    subject: `${appName} — Demande de création d'établissement : ${input.name}`,
    text,
    html,
  };
}
