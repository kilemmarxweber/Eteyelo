"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { updateUserLocaleAction } from "@/lib/user-locale.action";
import {
  LOCALE_OPTIONS,
  intlLocaleFromUserLocale,
  isUserLocale,
  normalizeUserLocale,
  writeUserLocalePreference,
  type UserLocale,
} from "@/lib/user-locale";
import { cn } from "@/lib/utils";

const LOCALE_UPDATED_TOAST: Record<UserLocale, string> = {
  fr: "Langue : français",
  en: "Language: English",
  pt: "Idioma: português de Portugal",
};

type LocalePreferenceButtonsProps = {
  className?: string;
  /** Affiche le libellé + description au-dessus des boutons. */
  showLabels?: boolean;
};

export function LocalePreferenceButtons({
  className,
  showLabels = true,
}: LocalePreferenceButtonsProps) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const activeLocale = useLocale();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [locale, setLocale] = useState<UserLocale>(
    normalizeUserLocale(activeLocale),
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLocale(normalizeUserLocale(activeLocale));
  }, [activeLocale]);

  function handleSelect(next: string) {
    if (!isUserLocale(next) || next === locale || pending) return;
    const previous = locale;
    setLocale(next);
    writeUserLocalePreference(next, userId);
    document.documentElement.lang = intlLocaleFromUserLocale(next);
    startTransition(() => {
      void updateUserLocaleAction(next)
        .then(() => {
          toast.success(LOCALE_UPDATED_TOAST[next]);
          router.refresh();
        })
        .catch(() => {
          setLocale(previous);
          writeUserLocalePreference(previous, userId);
          document.documentElement.lang = intlLocaleFromUserLocale(previous);
          toast.error(tCommon("errorGeneric"));
        });
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showLabels ? (
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">{t("language")}</p>
          <p className="text-sm text-muted-foreground">{t("languageHint")}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {LOCALE_OPTIONS.map((opt) => {
          const selected = locale === opt.value;
          return (
            <Button
              key={opt.value}
              type="button"
              variant={selected ? "default" : "outline"}
              disabled={pending}
              aria-pressed={selected}
              className={cn(
                "h-auto flex-col items-start gap-0.5 px-3 py-3 text-left",
                selected && "ring-2 ring-primary/30",
              )}
              onClick={() => handleSelect(opt.value)}
            >
              <span className="text-sm font-semibold">{opt.nativeLabel}</span>
              <span
                className={cn(
                  "text-[11px] font-normal",
                  selected ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {opt.value.toUpperCase()}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
