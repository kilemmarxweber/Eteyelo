"use client";
import { HTMLAttributes, useState, useEffect, type Ref } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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

function PriorityInput({
  value,
  onChange,
  onBlur,
  name,
  inputRef,
  className,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  name?: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!isFocused) {
      setText(value === undefined || value === null ? "" : String(value));
    }
  }, [value, isFocused]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="0"
      name={name}
      ref={inputRef}
      className={className}
      value={
        isFocused
          ? text
          : value === undefined || value === null
            ? ""
            : String(value)
      }
      onFocus={(event) => {
        const input = event.currentTarget;
        const next =
          value === undefined || value === null ? "" : String(value);
        setIsFocused(true);
        setText(next);
        requestAnimationFrame(() => input.select());
      }}
      onClick={(event) => {
        event.currentTarget?.select();
      }}
      onBlur={() => {
        setIsFocused(false);
        if (text === "") {
          onChange(undefined);
        } else {
          const parsed = Number(text);
          onChange(
            Number.isFinite(parsed)
              ? Math.min(100, Math.max(0, parsed))
              : undefined,
          );
        }
        onBlur?.();
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(/\D/g, "").slice(0, 3);
        if (raw === "") {
          setText("");
          onChange(undefined);
          return;
        }
        const parsed = Number(raw);
        if (parsed > 100) return;
        setText(raw);
        onChange(parsed);
      }}
    />
  );
}

interface FraisUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof fraisSchema>;
  classeId?: string;
  mode: "create" | "update";
  layout?: "default" | "dialog";
}

export function FraisUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  classeId,
  mode,
  layout = "default",
  ...props
}: FraisUpFormProps) {
  const isDialog = layout === "dialog";
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
      applyToCycle: false,
      applyToLevel: false,
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
    if (!initialData || mode !== "update") return;
    form.reset(initialData);
  }, [form, initialData?.id, mode]);
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
          applyToCycle: false,
          applyToLevel: false,
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
    <div
      className={cn(isDialog ? "grid gap-2" : "grid gap-6", className)}
      {...props}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={cn("grid", isDialog ? "gap-y-2" : "gap-4")}>
            <div
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2",
                isDialog ? "gap-x-4 gap-y-2" : "gap-4",
              )}
            >
              <FormField
                control={form.control}
                name="nameFrais"
                render={({ field }) => (
                  <FormItem className={isDialog ? "space-y-0.5" : "space-y-1"}>
                    <FormLabel
                      className={
                        isDialog
                          ? "text-xs font-medium text-muted-foreground"
                          : undefined
                      }
                    >
                      Nom du frais
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Frais d'inscription"
                        className={
                          isDialog
                            ? "h-9 rounded-md px-3 text-sm font-normal"
                            : undefined
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem className={isDialog ? "space-y-0.5" : "space-y-1"}>
                    <FormLabel
                      className={
                        isDialog
                          ? "text-xs font-medium text-muted-foreground"
                          : undefined
                      }
                    >
                      Priorité (0-100)
                    </FormLabel>
                    <FormControl>
                      <PriorityInput
                        name={field.name}
                        inputRef={field.ref}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        className={
                          isDialog
                            ? "h-9 rounded-md px-3 text-sm font-normal"
                            : undefined
                        }
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
            <div
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2",
                isDialog ? "gap-x-4 gap-y-2" : "gap-4",
              )}
            >
              <FormField
                control={form.control}
                name="montantFrais"
                render={({ field }) => (
                  <FormItem className={isDialog ? "space-y-0.5" : "space-y-1"}>
                    <FormLabel
                      className={
                        isDialog
                          ? "text-xs font-medium text-muted-foreground"
                          : undefined
                      }
                    >
                      Montant
                    </FormLabel>
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
                  <FormItem className={isDialog ? "space-y-0.5" : "space-y-1"}>
                    <FormLabel
                      className={
                        isDialog
                          ? "text-xs font-medium text-muted-foreground"
                          : undefined
                      }
                    >
                      Type de frais
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger
                          className={
                            isDialog
                              ? "h-9 rounded-md px-3 text-sm font-normal"
                              : undefined
                          }
                        >
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
                  <FormItem className={isDialog ? "space-y-0.5" : "space-y-1"}>
                    <FormLabel
                      className={
                        isDialog
                          ? "text-xs font-medium text-muted-foreground"
                          : undefined
                      }
                    >
                      Classe
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger
                          className={
                            isDialog
                              ? "h-9 rounded-md px-3 text-sm font-normal"
                              : undefined
                          }
                        >
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

            {mode === "create" ? (
              <div className="grid gap-2 sm:col-span-2">
                <FormField
                  control={form.control}
                  name="applyToCycle"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={Boolean(field.value)}
                          onCheckedChange={(value) =>
                            field.onChange(Boolean(value))
                          }
                        />
                      </FormControl>
                      <FormLabel className="text-xs font-normal">
                        Appliquer à toutes les classes de ce cycle
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="applyToLevel"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={Boolean(field.value)}
                          onCheckedChange={(value) =>
                            field.onChange(Boolean(value))
                          }
                        />
                      </FormControl>
                      <FormLabel className="text-xs font-normal">
                        Appliquer à toutes les classes de ce niveau
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="echeance"
              render={({ field }) => (
                <FormItem className={isDialog ? "space-y-0.5" : "space-y-1"}>
                  <FormLabel
                    className={
                      isDialog
                        ? "text-xs font-medium text-muted-foreground"
                        : undefined
                    }
                  >
                    Date d&apos;échéance (optionnel)
                  </FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            isDialog ? "h-9 rounded-md px-3" : "h-10",
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
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
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
                          Date d&apos;échéance
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

            <Button
              type="submit"
              size={isDialog ? "default" : undefined}
              className={cn(
                "mt-2 w-full font-medium",
                isDialog && "h-11 text-base",
              )}
              loading={isLoading}
            >
              {mode === "create"
                ? "Enregistrer le frais"
                : "Mettre à jour le frais"}
            </Button>

            {errorMessage ? (
              <p
                className={cn(
                  "mt-2 text-center text-red-500",
                  isDialog ? "text-xs" : "text-sm",
                )}
              >
                {errorMessage}
              </p>
            ) : null}
          </div>
        </form>
      </Form>
    </div>
  );
}
