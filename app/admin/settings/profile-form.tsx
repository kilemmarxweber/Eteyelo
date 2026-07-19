"use client";

import { useEffect } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/custom/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  updateCurrentProfileAction,
  type ProfileFormState,
} from "./profile.action";

const profileSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  name: z.string().trim().min(2, "Nom requis (min. 2 caracteres)"),
  prenom: z.string().trim().optional(),
  postnom: z.string().trim().optional(),
  sexe: z.string().trim().optional(),
  telephone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

function toFormValues(profile: ProfileFormState): ProfileValues {
  return {
    id: profile.id,
    username: profile.username,
    email: profile.email,
    name: profile.name,
    prenom: profile.prenom,
    postnom: profile.postnom,
    sexe: profile.sexe,
    telephone: profile.telephone,
    address: profile.address,
    dateOfBirth: profile.dateOfBirth,
  };
}

type ProfileFormProps = {
  initialProfile: ProfileFormState;
};

export default function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const { refetch } = authClient.useSession();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toFormValues(initialProfile),
    mode: "onChange",
  });

  useEffect(() => {
    form.reset(toFormValues(initialProfile));
  }, [form, initialProfile]);

  function onSubmit(values: ProfileValues) {
    startTransition(() => {
      void (async () => {
        const result = await updateCurrentProfileAction({
          name: values.name,
          prenom: values.prenom,
          postnom: values.postnom,
          sexe: values.sexe,
          telephone: values.telephone,
          address: values.address,
          dateOfBirth: values.dateOfBirth,
        });

        if (!result.success) {
          toast.error(result.error ?? "Mise a jour impossible");
          return;
        }

        if (result.profile) {
          form.reset(toFormValues(result.profile));
        }

        await refetch();
        toast.success("Profil mis a jour.");
      })();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profil</h3>
        <p className="text-sm text-muted-foreground">
          Vos informations personnelles. Vous pouvez modifier votre nom,
          prenom et post-nom.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compte</CardTitle>
              <CardDescription>
                Identifiants du compte connecte (lecture seule).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} disabled />
                    </FormControl>
                    <FormDescription>
                      L&apos;email se change depuis Mon compte.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code d&apos;acces</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormDescription>
                      Identifiant de connexion (non modifiable ici).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identite</CardTitle>
              <CardDescription>
                Nom affiche dans l&apos;application et sur les documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Votre nom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prenom</FormLabel>
                    <FormControl>
                      <Input placeholder="Votre prenom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postnom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Post-nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Votre post-nom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sexe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexe</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? "" : value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Non renseigne</SelectItem>
                        <SelectItem value="M">Masculin</SelectItem>
                        <SelectItem value="F">Feminin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de naissance</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telephone</FormLabel>
                    <FormControl>
                      <Input placeholder="+243..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Adresse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={isPending}
              disabled={!form.formState.isDirty}
              className="w-full sm:w-auto"
            >
              Mettre a jour le profil
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
