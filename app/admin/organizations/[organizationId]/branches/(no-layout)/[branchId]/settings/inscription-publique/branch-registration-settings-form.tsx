"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  branchRegistrationInfoFormSchema,
  type BranchRegistrationInfoFormValues,
} from "@/app/admin/organizations/[organizationId]/inscription-publique/schema";
import {
  getBranchRegistrationSettingsAction,
  saveBranchRegistrationSettingsAction,
} from "../inscription-publique.action";

type SchoolYearOption = {
  id: string;
  nameYear: string;
  isCurrentYear: boolean;
};

export function BranchRegistrationSettingsForm() {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);

  const form = useForm<BranchRegistrationInfoFormValues>({
    resolver: zodResolver(branchRegistrationInfoFormSchema),
    defaultValues: {
      branchId: "",
      schoolYearId: "",
      isPublished: false,
      termsTitle: "Conditions d'inscription",
      termsContent: "",
      registrationFeeRequired: true,
      registrationFeeAmount: "",
      registrationFeeCurrency: "CDF",
      registrationFeeLabel: "Frais d'inscription",
      registrationFeeDueNote:
        "A regler aupres de la caisse avant la confirmation du dossier.",
      rentreeProgram: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rentreeProgram",
  });

  const feeRequired = form.watch("registrationFeeRequired");

  useEffect(() => {
    let ignore = false;
    startTransition(async () => {
      try {
        const data = await getBranchRegistrationSettingsAction();
        if (ignore) return;
        setSchoolYears(data.schoolYears);
        const defaults: Partial<BranchRegistrationInfoFormValues> = {
          id: undefined,
          schoolYearId: "",
          isPublished: false,
          termsTitle: "Conditions d'inscription",
          termsContent: "",
          registrationFeeRequired: true,
          registrationFeeAmount: "",
          registrationFeeCurrency: "CDF",
          registrationFeeLabel: "Frais d'inscription",
          registrationFeeDueNote:
            "A regler aupres de la caisse avant la confirmation du dossier.",
          rentreeProgram: [],
        };
        form.reset({
          ...defaults,
          ...data.initialValues,
          branchId: data.branchId,
        });
      } catch (error) {
        if (ignore) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Impossible de charger les infos d'inscription.",
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
    // Chargement initial une seule fois a l'ouverture de la page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(values: BranchRegistrationInfoFormValues) {
    startTransition(async () => {
      const result = await saveBranchRegistrationSettingsAction(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
    });
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Chargement des parametres…</p>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Communication publique</h2>
          <p className="text-sm text-muted-foreground">
            Conditions, frais et programme de rentree affiches sur
            /inscription-eleve apres le choix de cette ecole.
          </p>
        </div>

        <FormField
          control={form.control}
          name="schoolYearId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Annee scolaire</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Annee courante recommandee" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.nameYear}
                      {year.isCurrentYear ? " (courante)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Preferer l&apos;annee scolaire courante.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 rounded-xl border p-4">
          <h3 className="font-semibold">Conditions d&apos;inscription</h3>
          <FormField
            control={form.control}
            name="termsTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Titre *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="termsContent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contenu *</FormLabel>
                <FormControl>
                  <Textarea
                    rows={10}
                    placeholder="Pieces a fournir, regles, calendrier administratif..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <h3 className="font-semibold">Frais d&apos;inscription</h3>
          <FormField
            control={form.control}
            name="registrationFeeRequired"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                </FormControl>
                <div>
                  <FormLabel>Signaler un frais d&apos;inscription</FormLabel>
                  <FormDescription>
                    Affiche une alerte sur la page publique.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {feeRequired ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="registrationFeeAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant *</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationFeeCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Devise</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CDF">CDF</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="AOA">AOA</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationFeeLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Libelle</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationFeeDueNote"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Note d&apos;echeance</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Programme de rentree</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ date: "", title: "", description: "" })}
            >
              <Plus className="mr-2 size-4" />
              Ajouter
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun evenement. Ajoutez les dates importantes de la rentree.
            </p>
          ) : null}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[160px_1fr_auto]"
              >
                <FormField
                  control={form.control}
                  name={`rentreeProgram.${index}.date`}
                  render={({ field: itemField }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...itemField} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name={`rentreeProgram.${index}.title`}
                    render={({ field: itemField }) => (
                      <FormItem>
                        <FormLabel>Titre</FormLabel>
                        <FormControl>
                          <Input {...itemField} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`rentreeProgram.${index}.description`}
                    render={({ field: itemField }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...itemField} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="self-start text-destructive"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <FormField
          control={form.control}
          name="isPublished"
          render={({ field }) => (
            <FormItem className="flex items-start gap-3 space-y-0 rounded-xl border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                />
              </FormControl>
              <div>
                <FormLabel>Publier sur /inscription-eleve</FormLabel>
                <FormDescription>
                  Tant que ce n&apos;est pas publie, les parents ne voient pas
                  ces informations.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
