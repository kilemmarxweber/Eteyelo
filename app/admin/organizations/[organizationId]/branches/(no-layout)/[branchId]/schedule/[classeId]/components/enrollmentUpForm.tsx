"use client";
import { HTMLAttributes, useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
import { useLocale, useTranslations } from "next-intl";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

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
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof enrollmentSchema>;
  onTeacherUpdate?: () => void;
  organizationId: string;
  mode: "create" | "update";
}

export function EnrollmentUpForm({
  className,
  onTeacherCreated,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  organizationId,
  mode,
  ...props
}: TeacherUpFormProps) {
  const t = useTranslations("users.teachers.form");
  const ts = useTranslations("users.students.form");
  const tc = useTranslations("common");
  const peopleLabels = useBranchPeopleLabels();
  const locale = useLocale();
  const teacherLabel = {
    teacher: peopleLabels.teacher,
    teacherLower: peopleLabels.teacherLower,
  };
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const params = useParams();
  const branchId =
    typeof params?.branchId === "string" ? params.branchId : undefined;

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
          organizationId,
          branchId,
          name: `${data.nom} ${data.postnom} ${data.prenom}`,
          statusUser: "enseignant",
        });
        if (!res.ok) {
          throw new Error(res.message);
        }
        toast.success(t("createSuccess", teacherLabel));
        onCreated?.();
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
        toast.success(t("updateSuccess", teacherLabel));
      }
      if (mode === "update") {
        onUpdated?.();
      }
      onSuccess?.();
      onTeacherCreated?.();
    } catch (error: any) {
      setErrorMessage(error.message);
      toast.error(
        error.message ||
          (mode === "create"
            ? t("createFailed", teacherLabel)
            : t("updateFailed", teacherLabel)),
      );
    } finally {
      setIsLoading(false);
    }
  }

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
                  <FormLabel>{tc("person.lastName")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>{tc("person.postnom")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>{tc("person.firstName")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>{tc("person.birthDate")}</FormLabel>
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
                            new Date(field.value).toLocaleDateString(locale, {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })
                          ) : (
                            <span>{ts("chooseDate")}</span>
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
                    <FormLabel>{tc("person.phone")}</FormLabel>
                    <FormControl>
                      <PhoneInput
                        defaultCountry="CD"
                        placeholder={tc("person.phone")}
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
                    <FormLabel>{tc("person.gender")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={ts("selectGender")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem key={"masculin"} value={"masculin"}>
                          {tc("person.male")}
                        </SelectItem>
                        <SelectItem key={"feminin"} value={"feminin"}>
                          {tc("person.female")}
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
                  <FormLabel>{tc("person.email")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={tc("codeAutoGenerated")}
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
                ? t("saveTeacher", teacherLabel)
                : t("updateTeacher", teacherLabel)}
            </Button>
            {errorMessage && (
              <p className="mt-2 text-center text-red-500">{errorMessage}</p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
