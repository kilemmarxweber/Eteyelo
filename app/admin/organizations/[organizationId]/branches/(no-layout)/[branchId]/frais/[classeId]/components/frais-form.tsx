"use client";
import { HTMLAttributes, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MontantInput } from "@/components/ui/montant-input";
import { Button } from "@/components/custom/button";
import { Button as UiButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { fr as frDayPicker } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createFraisAction,
  updateFraisAction,
  getTypeFraisAction,
} from "../../frais.action";
import { fraisSchema, ITypeFrais } from "@/src/interfaces/Frais";
import { IClasse } from "@/src/interfaces/Classe";
import { getClassesAction } from "../../../classe/classe.action";

const numberInputClassName =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function formatNumberInputValue(value: number | undefined) {
  return value === undefined || value === null || value === 0 ? "" : value;
}

function clearZeroOnFocus(
  value: number | undefined,
  onChange: (value: number | undefined) => void,
) {
  if (value === 0) {
    onChange(undefined);
  }
}

interface FraisUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof fraisSchema>;
  classeId?: string;
  mode: "create" | "update";
}

export function FraisUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  classeId,
  mode,
  ...props
}: FraisUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [Classes, setClasses] = useState<IClasse[]>([]);
  const [TypesFrais, setTypesFrais] = useState<ITypeFrais[]>([]);

  const form = useForm<z.infer<typeof fraisSchema>>({
    resolver: zodResolver(fraisSchema),
    defaultValues: initialData || {
      id: "",
      nameFrais: "",
      montantFrais: undefined,
      statusFrais: true,
      classeId: classeId || "",
      typeFraisId: "",
      echeance: undefined,
      priority: undefined,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Charger les classes
        const [rawClasses, classError] = await getClassesAction();
        if (classError) {
          throw new Error(classError.message);
        }
        setClasses(rawClasses);

        // Charger les types de frais
        const [rawTypes, typeError] = await getTypeFraisAction();
        if (typeError) {
          throw new Error(typeError.message);
        }
        setTypesFrais(rawTypes);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        toast.error("Erreur lors du chargement des données");
      }
    };
    fetchData();
  }, []);
  useEffect(() => {
    if (initialData && mode === "update") {
      form.reset(initialData); // 🔥 TRÈS IMPORTANT
    }
  }, [initialData, mode]);
  async function onSubmit(data: z.infer<typeof fraisSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [frais, err] = await createFraisAction({
          ...data,
          statusFrais: true,
          classeId: classeId || data.classeId,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Frais créé avec succès");
        form.reset({
          id: "",
          nameFrais: "",
          montantFrais: undefined,
          statusFrais: true,
          classeId: classeId || "",
          typeFraisId: "",
          echeance: undefined,
          priority: undefined,
        });
        onCreated?.();
      } else {
        const [frais, err] = await updateFraisAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Frais mis à jour avec succès");
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error) {
      console.error("Erreur:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Une erreur est survenue",
      );
      toast.error(
        mode === "create"
          ? "Échec de la création du frais"
          : "Échec de la mise à jour du frais",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nameFrais"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Nom du frais</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Frais d'inscription" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Priorité (0-100)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className={numberInputClassName}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={formatNumberInputValue(field.value)}
                        onFocus={() => clearZeroOnFocus(field.value, field.onChange)}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(
                            value === "" ? undefined : Number(value),
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="id"
                render={({ field }) => <input type="hidden" {...field} />}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="montantFrais"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Montant</FormLabel>
                    <FormControl>
                      <MontantInput
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="typeFraisId"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Type de frais</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          Aucun type spécifique
                        </SelectItem>
                        {TypesFrais.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.nameType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!classeId && (
              <FormField
                control={form.control}
                name="classeId"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Classe</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une classe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Classes.map((classe) => (
                          <SelectItem key={classe.id} value={classe.id}>
                            {classe.nameClasse} ({classe.codeClasse})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="echeance"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Date d'échéance (optionnel)</FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <button
                          type="button"
                          className={cn(
                            "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
                          <span className="flex-1 text-left">
                            {field.value
                              ? format(field.value, "d MMMM yyyy", {
                                  locale: fr,
                                })
                              : "Sélectionner une date"}
                          </span>
                          {field.value ? (
                            <span
                              role="button"
                              tabIndex={0}
                              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                field.onChange(undefined);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  field.onChange(undefined);
                                }
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto overflow-hidden rounded-xl border p-0 shadow-lg"
                      align="start"
                    >
                      <div className="border-b bg-muted/30 px-4 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Date d'échéance
                        </p>
                        <p className="mt-0.5 text-sm font-semibold capitalize text-foreground">
                          {field.value
                            ? format(field.value, "EEEE d MMMM yyyy", {
                                locale: fr,
                              })
                            : "Aucune date sélectionnée"}
                        </p>
                      </div>
                      <Calendar
                        mode="single"
                        locale={frDayPicker}
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          if (date) setCalendarOpen(false);
                        }}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                        className="p-3"
                        classNames={{
                          today: "bg-primary/10 text-primary font-semibold",
                        }}
                      />
                      {field.value ? (
                        <div className="border-t p-2">
                          <UiButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => {
                              field.onChange(undefined);
                              setCalendarOpen(false);
                            }}
                          >
                            Effacer la date
                          </UiButton>
                        </div>
                      ) : null}
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="mt-4" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer le frais"
                : "Mettre à jour le frais"}
            </Button>

            {errorMessage && (
              <p className="mt-2 text-center text-red-500 text-sm">
                {errorMessage}
              </p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
