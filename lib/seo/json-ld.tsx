import {
  SITE_DESCRIPTION,
  SITE_LEGAL_NAME,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_URL,
  absoluteUrl,
} from "@/lib/seo/site";

type JsonLdValue = Record<string, unknown> | Record<string, unknown>[];

/** Script JSON-LD sûr pour le DOM (échappe `</` dans les chaînes). */
export function JsonLd({ data }: { data: JsonLdValue }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    legalName: SITE_LEGAL_NAME,
    url: SITE_URL,
    logo: absoluteUrl(SITE_OG_IMAGE),
    description: SITE_DESCRIPTION,
    email: "contact@klambocore.com",
    telephone: "+243844952966",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Avenue Route Bypass 425, Mont-Ngafula",
      addressLocality: "Kinshasa",
      addressCountry: "CD",
    },
    sameAs: [] as string[],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: SITE_LEGAL_NAME,
    },
    inLanguage: "fr-CD",
  };
}

type EducationalOrgInput = {
  id: string;
  name: string;
  description?: string;
  ville?: string | null;
  pays?: string | null;
  adresse?: string | null;
  tel?: string | null;
  image?: string;
};

export function educationalOrganizationJsonLd(input: EducationalOrgInput) {
  const url = absoluteUrl(`/etablissements/${input.id}`);

  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: input.name,
    url,
    description:
      input.description ||
      `${input.name}${input.ville ? ` — ${input.ville}` : ""} sur ${SITE_NAME}.`,
    ...(input.image
      ? { image: input.image.startsWith("http") ? input.image : absoluteUrl(input.image) }
      : {}),
    ...(input.tel ? { telephone: input.tel } : {}),
    ...(input.adresse || input.ville || input.pays
      ? {
          address: {
            "@type": "PostalAddress",
            ...(input.adresse ? { streetAddress: input.adresse } : {}),
            ...(input.ville ? { addressLocality: input.ville } : {}),
            ...(input.pays ? { addressCountry: input.pays } : {}),
          },
        }
      : {}),
    parentOrganization: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}
