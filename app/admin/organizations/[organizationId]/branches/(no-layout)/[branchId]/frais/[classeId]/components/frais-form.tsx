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
import { Button } from "@/components/custom/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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

interface FraisUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onFraisCreated?: () => void;
  initialData?: z.infer<typeof fraisSchema>;
  onFraisUpdate?: () => void;
  classeId?: string;
  mode: "create" | "update";
}

export function FraisUpForm({
  className,
  onFraisCreated,
  initialData,
  classeId,
  mode,
  ...props
}: FraisUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [Classes, setClasses] = useState<IClasse[]>([]);
  const [TypesFrais, setTypesFrais] = useState<ITypeFrais[]>([]);

  const form = useForm<z.infer<typeof fraisSchema>>({
    resolver: zodResolver(fraisSchema),
    defaultValues: initialData || {
      id: "", // 👈 IMPORTANT
      nameFrais: "",
      montantFrais: 0,
      statusFrais: true,
      classeId: classeId || "",
      typeFraisId: "",
      echeance: undefined,
      priority: 0,
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
          montantFrais: 0,
          statusFrais: true,
          classeId: classeId || "",
          typeFraisId: "",
          echeance: undefined,
          priority: 0,
        });
      } else {
        const [frais, err] = await updateFraisAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Frais mis à jour avec succès");
      }
      onFraisCreated && onFraisCreated();
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

  const { theme } = useTheme();

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
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="montantFrais"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Montant ($)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: fr })
                          ) : (
                            <span>Sélectionner une date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button className="mt-4" loading={isLoading}>
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
