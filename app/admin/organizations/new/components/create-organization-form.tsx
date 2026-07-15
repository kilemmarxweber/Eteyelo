"use client";

import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  createOrganizationFormSchema,
  type CreateOrganizationFormValues,
} from "@/app/admin/organizations/schema";
import { generateSlug } from "@/lib/generated-identifiers";

export function CreateOrganizationForm() {
  const router = useRouter();
  const form = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createOrganizationFormSchema),
    defaultValues: { name: "", slug: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: CreateOrganizationFormValues) {
    form.clearErrors("root");
    try {
      const baseSlug = generateSlug(values.slug || values.name, "organisation").slice(0, 64);
      let data: any = null;
      let error: any = null;

      for (let index = 1; index <= 5; index += 1) {
        const suffix = index === 1 ? "" : `-${index}`;
        const slug = `${baseSlug.slice(0, 64 - suffix.length)}${suffix}`;
        const result = await authClient.organization.create({
          name: values.name.trim(),
          slug,
        });
        data = result.data;
        error = result.error;
        if (!error) break;
      }

      if (error) {
        form.setError("root", {
          type: "server",
          message: error.message ?? "Création impossible. Réessayez plus tard.",
        });
        toast.error(error.message ?? "Création impossible. Réessayez plus tard.");
        return;
      }

      const orgId = data?.id;
      if (orgId) {
        const { error: activeError } = await authClient.organization.setActive({
          organizationId: orgId,
        });
        if (activeError) {
          toast.message(
            "Organisation créée, mais l’activation par défaut a échoué. Choisissez-la dans les paramètres.",
            { description: activeError.message }
          );
        }
      }

      toast.success("Organisation creee.");
      router.push("/admin/organizations");
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible de joindre le serveur.";
      form.setError("root", {
        type: "server",
        message:
          "Connexion au serveur impossible. Vérifiez l’URL (localhost vs 127.0.0.1) et votre réseau.",
      });
      toast.error(message);
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit(onSubmit)(e);
        }}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom de l’organisation</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  autoComplete="organization"
                  placeholder="Église locale"
                  className="h-11"
                  disabled={isSubmitting}
                  onBlur={(e) => {
                    field.onBlur();
                    const slug = form.getValues("slug") ?? "";
                    if (!slug.trim()) {
                      const generated = generateSlug(e.target.value, "").slice(0, 64);
                      if (generated.length >= 2) {
                        form.setValue("slug", generated, {
                          shouldValidate: true,
                        });
                      }
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <input type="hidden" {...form.register("slug")} />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Création…" : "Créer l’organisation"}
        </Button>
      </form>
    </Form>
  );
}
