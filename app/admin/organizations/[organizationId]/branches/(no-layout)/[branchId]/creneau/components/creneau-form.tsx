"use client";
import { HTMLAttributes, useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
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
import { createCreneauAction, updateCreneauAction } from "../creneau.action";
import { getSectionsAction } from "../../section/section.action";
import { creneauSchema } from "@/src/interfaces/creneau";
import { ISection } from "@/src/interfaces/Section";

// Fonction pour convertir une chaîne de caractères HH:MM en objet Date
const timeStringToDate = (timeString: string): Date => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Fonction pour convertir un objet Date en chaîne de caractères HH:MM
const formatDateToTimeString = (date: Date): string => {
  return date.toTimeString().slice(0, 5);
};

interface CreneauUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onCreneauAction?: () => void;
  initialData?: z.infer<typeof creneauSchema>;
  mode: "create" | "update";
}

export function CreneauUpForm({
  className,
  onCreneauAction,
  initialData,
  mode,
  ...props
}: CreneauUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [CreneauCreated, setCreneauCreated] = useState(false);
  const [Sections, setSections] = useState<ISection[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<z.infer<typeof creneauSchema>>({
    resolver: zodResolver(creneauSchema),
    defaultValues: initialData || {
      nameCreneau: "",
    },
  });

  useEffect(() => {
    const fetchSections = async () => {
      const [rawSections, err] = await getSectionsAction();
      if (err) {
        throw err.message;
      }
      setSections(rawSections);
    };
    fetchSections();
  }, []);

  const filteredSections = Sections.filter((section) =>
    section.nameSection.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const onSubmit: SubmitHandler<z.infer<typeof creneauSchema>> = async (
    data,
  ) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [creneau, err] = await createCreneauAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Vacation créée avec succès");
      } else {
        const [creneau, err] = await updateCreneauAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Vacation mise à jour avec succès");
      }

      setCreneauCreated(true);
      onCreneauAction && onCreneauAction();
    } catch (error) {
      console.log(error);
      toast.error(
        mode === "create"
          ? "Échec de la création de le creneau"
          : "Échec de la mise à jour de le creneau",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="w-full max-w-md mx-auto grid gap-2">
            <FormField
              control={form.control}
              name="nameCreneau"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Nom de la vacation</FormLabel>
                  <FormControl>
                    <Input placeholder="Le nom de le creneau" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex space-x-2">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Debut</FormLabel>
                      <FormControl>
                        <Input type="time" placeholder="Début" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Fin</FormLabel>{" "}
                      <FormControl>
                        <Input type="time" placeholder="Fin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="durationCourse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Durée</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Durée en minutes"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="recreationHour"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Heure de récré</FormLabel>{" "}
                      <FormControl>
                        <Input type="time" placeholder="Fin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="recreationDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Durée de la récréation</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Durée en minutes"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <Button className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer la vacation"
                : "Mettre à jour la vacation"}
            </Button>
            {CreneauCreated && <DialogClose />}
            {errorMessage && (
              <p className="mt-2 text-center text-red-500">{errorMessage}</p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
