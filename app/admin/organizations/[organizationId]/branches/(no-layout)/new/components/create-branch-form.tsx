"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  createBranchFormSchema,
  type CreateBranchFormValues,
} from "../../schema";
import { createBranchAction } from "../../branche.action";

type CreateBranchFormProps = {
  organizationId: string;
};

export function CreateBranchForm({ organizationId }: CreateBranchFormProps) {
  const router = useRouter();
  const form = useForm<CreateBranchFormValues>({
    resolver: zodResolver(createBranchFormSchema),
    defaultValues: {
      name: "",
      code: "",
      latitude: 0,
      longitude: 0,
      attendanceRadius: 100,
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: CreateBranchFormValues) {
    form.clearErrors("root");

    try {
      const result = await createBranchAction(organizationId, values);

      if (result.error) {
        form.setError("root", {
          type: "server",
          message: result.error,
        });
        toast.error(result.error);
        return;
      }

      toast.success("Établissement créé.");
      router.push(`/admin/organizations/${organizationId}/branches`);
      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Impossible de joindre le serveur.";
      form.setError("root", {
        type: "server",
        message: "Création impossible. Réessayez plus tard.",
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
              <FormLabel>Nom de l’établissement</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  autoComplete="organization"
                  placeholder="Campus Kinshasa"
                  className="h-11"
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  autoCapitalize="characters"
                  placeholder="KIN"
                  className="h-11"
                  disabled={isSubmitting}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              </FormControl>
              <FormDescription>
                Optionnel. Sert à identifier rapidement l’établissement.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            control={form.control}
            name="latitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitude</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    step="any"
                    placeholder="-4.325"
                    className="h-11"
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="longitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitude</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    step="any"
                    placeholder="15.322"
                    className="h-11"
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="attendanceRadius"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rayon de présence</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={10}
                  step={1}
                  placeholder="100"
                  className="h-11"
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                Distance en mètres autorisée pour valider une présence.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Création…" : "Créer l’établissement"}
        </Button>
      </form>
    </Form>
  );
}
