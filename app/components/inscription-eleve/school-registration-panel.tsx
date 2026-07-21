"use client";

import { useEffect } from "react";
import { CalendarDays, FileText, Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  formatRegistrationFee,
  type PublicBranchRegistrationInfo,
} from "@/lib/registration-public-info";

type Props = {
  info: PublicBranchRegistrationInfo | null;
  loading?: boolean;
  onTermsVisible?: () => void;
};

export function SchoolRegistrationPanel({
  info,
  loading,
  onTermsVisible,
}: Props) {
  useEffect(() => {
    if (info?.termsContent) onTermsVisible?.();
  }, [info?.id, info?.termsContent, onTermsVisible]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        Chargement des informations de l&apos;ecole...
      </div>
    );
  }

  if (!info) {
    return (
      <Alert>
        <AlertTitle>Informations d&apos;inscription</AlertTitle>
        <AlertDescription>
          Cette ecole n&apos;a pas encore publie ses conditions, frais ou
          programme de rentree. Vous pouvez continuer la demande et contacter
          l&apos;etablissement pour les details.
        </AlertDescription>
      </Alert>
    );
  }

  const feeLabel = formatRegistrationFee(
    info.registrationFeeAmount,
    info.registrationFeeCurrency,
  );

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-foreground">{info.branchName}</h3>
        {info.schoolYearName ? (
          <Badge variant="outline">{info.schoolYearName}</Badge>
        ) : null}
      </div>

      {info.registrationFeeRequired ? (
        <Alert className="border-primary/30 bg-primary/5">
          <Wallet className="size-4" />
          <AlertTitle>
            {info.registrationFeeLabel || "Frais d'inscription"}
            {feeLabel ? ` — ${feeLabel}` : ""}
          </AlertTitle>
          <AlertDescription>
            {info.registrationFeeDueNote ||
              "A regler aupres de la caisse de l'etablissement."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4 text-primary" />
          {info.termsTitle || "Conditions d'inscription"}
        </div>
        <div className="max-h-[28rem] overflow-y-auto rounded-xl border bg-muted/20 p-3">
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
            {info.termsContent}
          </p>
        </div>
      </div>

      {info.rentreeProgram.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="size-4 text-primary" />
              Programme de rentree
            </div>
            <ul className="space-y-2">
              {info.rentreeProgram.map((item) => (
                <li
                  key={`${item.date}-${item.title}`}
                  className="rounded-xl border bg-muted/30 px-3 py-2"
                >
                  <p className="text-xs font-medium text-primary">
                    {formatProgramDate(item.date)}
                  </p>
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.description ? (
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

function formatProgramDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
