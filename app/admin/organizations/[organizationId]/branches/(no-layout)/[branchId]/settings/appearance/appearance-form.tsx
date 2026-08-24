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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

export function AppearanceForm() {
  const t = useTranslations("settings");
  const { setTheme, theme } = useTheme();
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
    if (theme === "light" || theme === "dark") {
      form.setValue("theme", theme);
    }
  }, [mounted, theme, form]);

  function onSubmit(data: AppearanceFormValues) {
    setTheme(data.theme);
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

                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value === "light" || value === "dark") {
                          setTheme(value);
                        }
                      }}
                      value={field.value}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >
                      <FormItem className="w-full">
                        <FormLabel className="w-full cursor-pointer">
                          <FormControl>
                            <RadioGroupItem
                              value="light"
                              className="sr-only"
                            />
                          </FormControl>

                          <div className="rounded-md border-2 border-muted p-2 hover:border-accent">
                            <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
                              <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                                <div className="h-2 w-[80px] bg-[#ecedef] rounded" />
                                <div className="h-2 w-[100px] bg-[#ecedef] rounded" />
                              </div>
                            </div>
                          </div>

                          <span className="block text-center mt-2 text-sm sm:text-base">
                            {t("themeLight")}
                          </span>
                        </FormLabel>
                      </FormItem>

                      <FormItem className="w-full">
                        <FormLabel className="w-full cursor-pointer">
                          <FormControl>
                            <RadioGroupItem
                              value="dark"
                              className="sr-only"
                            />
                          </FormControl>

                          <div className="rounded-md border-2 border-muted p-2 hover:bg-accent">
                            <div className="space-y-2 rounded-sm bg-slate-950 p-2">
                              <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                                <div className="h-2 w-[80px] bg-slate-400 rounded" />
                                <div className="h-2 w-[100px] bg-slate-400 rounded" />
                              </div>
                            </div>
                          </div>

                          <span className="block text-center mt-2 text-sm sm:text-base">
                            {t("themeDark")}
                          </span>
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
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
