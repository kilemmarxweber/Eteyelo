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
import { DialogClose } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createOrganizationMemberAction,
  updateUserAction,
} from "@/app/admin/organizations/[organizationId]/members/actions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { IconCalendar } from "@tabler/icons-react";
import { Calendar } from "@/components/ui/calendar";
import { PhoneInput } from "@/components/ui/phone-input";
import generateUsername from "@/src/hooks/generateUsername";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/,
);

export const enrollmentSchema = z.object({
  id: z.string().optional(),
  memberId: z.string().optional(),
  organizationId: z.string(),
  username: z.string().optional(),
  nom: z.string().min(3, { message: "Veuillez saisir le nom" }),
  postnom: z.string().min(3, { message: "Veuillez saisir le postnom" }),
  prenom: z.string().min(3, { message: "Veuillez saisir le prenom" }),
  dateOfBirth: z.date(),
  sexe: z.string().min(4, { message: "Veuillez saisir le sexe" }),
  telephone: z.string().regex(phoneRegex, "Invalid Number!"),
  email: z.string().email({ message: "Veuillez saisir un email valide" }),
  address: z.string().optional(), // 👈 optionnel ici
  orgRole: z.enum(["owner", "admin", "member"]),
  name: z.string().optional(),
  statusUser: z.string().optional(),
});

interface TeacherUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onTeacherCreated?: () => void;
  initialData?: z.infer<typeof enrollmentSchema>;
  onTeacherUpdate?: () => void;
  organizationId: string;
  mode: "create" | "update";
}

export function EnrollmentUpForm({
  className,
  onTeacherCreated,
  initialData,
  organizationId,
  mode,
  ...props
}: TeacherUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [userCreated, setUserCreated] = useState(false);

  const form = useForm<z.infer<typeof enrollmentSchema>>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: initialData || {
      id: "",
      memberId: "",
      organizationId: organizationId,
      username: "",
      nom: "",
      prenom: "",
      postnom: "",
      sexe: "",
      dateOfBirth: new Date(),
      telephone: "",
      email: "",
      address: "",
      orgRole: "member",
    },
  });

  useEffect(() => {
    const nom = form.getValues("nom");
    const prenom = form.getValues("prenom");

    if (nom && prenom) {
      const username = generateUsername("prof", nom, prenom);
      if (mode === "create") {
        form.setValue("username", username);
      } else if (!form.getValues("username")) {
        form.setValue("username", username);
      }
    }
  }, [form.watch("nom"), form.watch("prenom"), mode]);

  async function onSubmit(data: z.infer<typeof enrollmentSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const res = await createOrganizationMemberAction({
          ...data,
          name: `${data.nom} ${data.postnom} ${data.prenom}`,
          statusUser: "enseignant",
        });
        if (!res.ok) {
          throw new Error(res.message);
        }
        toast.success("Enseignant créé avec succès");
      } else {
        if (!data.memberId) {
          throw new Error("L'identifiant du membre est manquant.");
        }
        const res = await updateUserAction({
          id: data.id,
          nom: data.nom,
          postnom: data.postnom,
          prenom: data.prenom,
          dateOfBirth: data.dateOfBirth,
          sexe: data.sexe,
          telephone: data.telephone,
          email: data.email,
          address: data.address,
        });

        if (!res.ok) {
          throw new Error(res.message);
        }
        toast.success("Enseignant mis à jour avec succès");
      }
      setUserCreated(true);
      onTeacherCreated && onTeacherCreated(); // Appeler la fonction de rafraîchissement
    } catch (error: any) {
      setErrorMessage(error.message);
      toast.error(
        error.message ||
          (mode === "create"
            ? "Échec de la création de l'enseignant"
            : "Échec de la mise à jour de l' enseignant"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Le nom du Enseignant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postnom"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Postnom</FormLabel>
                  <FormControl>
                    <Input placeholder="Le postnom du Enseignant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prenom"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Prénom</FormLabel>
                  <FormControl>
                    <Input placeholder="le prénom du Enseignant" {...field} />
                  </FormControl>
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-between text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            new Date(field.value).toLocaleDateString("fr-FR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })
                          ) : (
                            <span>Choisir une date</span>
                          )}

                          <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>

                    <PopoverContent
                      className="w-auto p-0"
                      align="start"
                      side="bottom"
                    >
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        fromYear={1900}
                        toYear={new Date().getFullYear()}
                        selected={
                          field.value ? new Date(field.value) : undefined
                        }
                        onSelect={(date) => {
                          field.onChange(date);
                        }}
                      />
                    </PopoverContent>
                  </Popover>

                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Téléphone </FormLabel>
                    <FormControl>
                      <PhoneInput
                        defaultCountry="CD"
                        placeholder="Téléphone"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sexe"
                render={({ field }) => (
                  <FormItem className="space-y-1 w-1/2">
                    <FormLabel>Sexe</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez le sexe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem key={"masculin"} value={"masculin"}>
                          Masculin
                        </SelectItem>
                        <SelectItem key={"feminin"} value={"feminin"}>
                          Féminin
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>E-mail </FormLabel>
                  <FormControl>
                    <Input placeholder="le Email du Enseignant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Code d'acces</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Le code sera généré automatiquement"
                      {...field}
                      disabled
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer l'enseignant"
                : "Mettre à jour l'enseignant"}
            </Button>
            {userCreated && <DialogClose />}
            {errorMessage && (
              <p className="mt-2 text-center text-red-500">{errorMessage}</p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
