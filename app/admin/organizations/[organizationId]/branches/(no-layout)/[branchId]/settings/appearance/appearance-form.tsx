"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/custom/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useTheme } from "next-themes";
import { LocalePreferenceButtons } from "@/components/locale-preference-buttons";
import { cn } from "@/lib/utils";
import { updateUserThemeAction } from "@/lib/user-theme.action";
import { isUserTheme } from "@/lib/user-theme";

export function AppearanceForm() {
  const t = useTranslations("settings");
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const appearanceFormSchema = z.object({
    theme: z.enum(["light", "dark"], {
      required_error: t("themeRequired"),
    }),
    font: z.enum(["inter", "manrope", "system"], {
      invalid_type_error: t("fontInvalid"),
      required_error: t("fontRequired"),
    }),
  });

  type AppearanceFormValues = z.infer<typeof appearanceFormSchema>;

  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: {
      theme: "light",
      font: "inter",
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const current =
      theme === "light" || theme === "dark" ? theme : resolvedTheme;
    if (current === "light" || current === "dark") {
      form.setValue("theme", current);
    }
  }, [mounted, theme, resolvedTheme, form]);

  function applyTheme(value: "light" | "dark") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(value);
    root.style.colorScheme = value;
    setTheme(value);
    if (isUserTheme(value)) {
      void updateUserThemeAction(value).catch((err) => {
        console.error("[AppearanceForm] échec sauvegarde thème:", err);
      });
    }
  }

  function onSubmit(data: AppearanceFormValues) {
    applyTheme(data.theme);
    toast({
      title: t("prefsUpdated"),
      description: t("prefsUpdatedDesc"),
    });
  }

  return (
    <div className="space-y-6 px-2 sm:px-4 md:px-6">
      <div className="space-y-2">
        <h3 className="text-lg sm:text-xl font-medium">{t("appearance")}</h3>
        <p className="text-sm text-muted-foreground">{t("appearanceDesc")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{t("language")}</CardTitle>
          <CardDescription>{t("languageDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LocalePreferenceButtons showLabels={false} />
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">{t("theme")}</CardTitle>
              <CardDescription>{t("themeDesc")}</CardDescription>
            </CardHeader>

            <CardContent>
              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormMessage />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          field.onChange("light");
                          applyTheme("light");
                        }}
                        className={cn(
                          "w-full rounded-md border-2 p-2 text-left transition-colors hover:border-accent",
                          field.value === "light"
                            ? "border-primary"
                            : "border-muted",
                        )}
                      >
                        <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
                          <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                            <div className="h-2 w-[80px] rounded bg-[#ecedef]" />
                            <div className="h-2 w-[100px] rounded bg-[#ecedef]" />
                          </div>
                        </div>
                        <span className="mt-2 block text-center text-sm sm:text-base">
                          {t("themeLight")}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          field.onChange("dark");
                          applyTheme("dark");
                        }}
                        className={cn(
                          "w-full rounded-md border-2 p-2 text-left transition-colors hover:border-accent",
                          field.value === "dark"
                            ? "border-primary"
                            : "border-muted",
                        )}
                      >
                        <div className="space-y-2 rounded-sm bg-slate-950 p-2">
                          <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                            <div className="h-2 w-[80px] rounded bg-slate-400" />
                            <div className="h-2 w-[100px] rounded bg-slate-400" />
                          </div>
                        </div>
                        <span className="mt-2 block text-center text-sm sm:text-base">
                          {t("themeDark")}
                        </span>
                      </button>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">{t("font")}</CardTitle>
              <CardDescription>{t("fontDesc")}</CardDescription>
            </CardHeader>

            <CardContent>
              <FormField
                control={form.control}
                name="font"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger className="w-full sm:w-[250px]">
                          <SelectValue placeholder={t("fontPlaceholder")} />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="inter">Inter</SelectItem>
                          <SelectItem value="manrope">Manrope</SelectItem>
                          <SelectItem value="system">{t("fontSystem")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button type="submit" className="w-full sm:w-auto">
              {t("update")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
