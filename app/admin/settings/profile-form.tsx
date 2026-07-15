"use client";

import { useEffect } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
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
  getCurrentProfileAction,
  updateCurrentProfileAction,
  type ProfileFormState,
} from "./profile.action";

const profileSchema = z.object({
  id: z.string(),
  username: z.string().trim().min(3, "Nom d'utilisateur requis"),
  email: z.string(),
  name: z.string().trim().min(2, "Nom requis"),
  prenom: z.string().trim().optional(),
  postnom: z.string().trim().optional(),
  sexe: z.string().trim().optional(),
  telephone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  image: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

const emptyProfile: ProfileValues = {
  id: "",
  username: "",
  email: "",
  name: "",
  prenom: "",
  postnom: "",
  sexe: "",
  telephone: "",
  address: "",
  image: "",
  dateOfBirth: "",
};

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
    image: profile.image,
    dateOfBirth: profile.dateOfBirth,
  };
}

export default function ProfileForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyProfile,
    mode: "onChange",
  });

  useEffect(() => {
    let mounted = true;

    void getCurrentProfileAction().then((result) => {
      if (!mounted) return;

      if (result.error || !result.profile) {
        toast.error(result.error ?? "Profil introuvable");
        return;
      }

      form.reset(toFormValues(result.profile));
    });

    return () => {
      mounted = false;
    };
  }, [form]);

  function onSubmit(values: ProfileValues) {
    startTransition(() => {
      void (async () => {
        const result = await updateCurrentProfileAction({
          username: values.username,
          name: values.name,
          prenom: values.prenom,
          postnom: values.postnom,
          sexe: values.sexe,
          telephone: values.telephone,
          address: values.address,
          image: values.image,
          dateOfBirth: values.dateOfBirth,
        });

        if (!result.success) {
          toast.error(result.error ?? "Mise a jour impossible");
          return;
        }

        if (result.profile) {
          form.reset(toFormValues(result.profile));
        }

        toast.success("Profil mis a jour. Un email de confirmation a ete envoye.");
      })();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profil</h3>
        <p className="text-sm text-muted-foreground">
          Modifiez vos informations personnelles. L'adresse email reste
          verrouillee pour proteger votre compte.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compte</CardTitle>
              <CardDescription>
                Identifiants du compte connecte.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID utilisateur</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      L'email ne peut pas etre modifie depuis ce profil.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nom d'utilisateur</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom d'utilisateur" {...field} />
                    </FormControl>
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
                Informations personnelles affichees dans l'application.
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
                      <Input placeholder="Nom" {...field} />
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
                      <Input placeholder="Prenom" {...field} />
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
                      <Input placeholder="Post-nom" {...field} />
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
                        <SelectItem value="masculin">Masculin</SelectItem>
                        <SelectItem value="feminin">Feminin</SelectItem>
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
                name="image"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Image</FormLabel>
                    <FormControl>
                      <Input placeholder="URL ou data image" {...field} />
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
