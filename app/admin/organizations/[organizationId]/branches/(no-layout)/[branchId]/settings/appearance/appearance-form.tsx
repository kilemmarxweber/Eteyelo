"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconChevronDown } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/custom/button";
import {
  Form,
  FormControl,
  FormDescription,
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

const appearanceFormSchema = z.object({
  theme: z.enum(["light", "dark"], {
    required_error: "Veuillez sélectionner un thème.",
  }),
  font: z.enum(["inter", "manrope", "system"], {
    invalid_type_error: "Sélectionnez une police",
    required_error: "Veuillez sélectionner une police.",
  }),
});

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>;

// This can come from your database or API.
const defaultValues: Partial<AppearanceFormValues> = {
  theme: "light",
};

export function AppearanceForm() {
  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues,
  });

  function onSubmit(data: AppearanceFormValues) {
    toast({
      title: "Préférences mises à jour",
      description: "Vos préférences d'apparence ont été sauvegardées.",
    });
  }
  const { setTheme, theme } = useTheme();

  return (
    <div className="space-y-6 px-2 sm:px-4 md:px-6">
      {/* HEADER */}
      <div className="space-y-2">
        <h3 className="text-lg sm:text-xl font-medium">Apparence</h3>
        <p className="text-sm text-muted-foreground">
          Personnalisez l'apparence de votre interface et basculez entre le mode
          clair et sombre.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* ===== THEME ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Thème</CardTitle>
              <CardDescription>
                Choisissez le thème pour votre interface.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormMessage />

                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={theme}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >
                      {/* LIGHT */}
                      <FormItem className="w-full">
                        <FormLabel className="w-full cursor-pointer">
                          <FormControl>
                            <RadioGroupItem
                              value="light"
                              className="sr-only"
                              onClick={() => setTheme("light")}
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
                            Clair
                          </span>
                        </FormLabel>
                      </FormItem>

                      {/* DARK */}
                      <FormItem className="w-full">
                        <FormLabel className="w-full cursor-pointer">
                          <FormControl>
                            <RadioGroupItem
                              value="dark"
                              className="sr-only"
                              onClick={() => setTheme("dark")}
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
                            Sombre
                          </span>
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ===== FONT ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Police</CardTitle>
              <CardDescription>
                Définissez la police du tableau de bord.
              </CardDescription>
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
                          <SelectValue placeholder="Sélectionnez une police" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="inter">Inter</SelectItem>
                          <SelectItem value="manrope">Manrope</SelectItem>
                          <SelectItem value="system">Système</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ===== BUTTON ===== */}
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button type="submit" className="w-full sm:w-auto">
              Mettre à jour
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
