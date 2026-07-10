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
import { IconSelector, IconCheck } from "@tabler/icons-react";
import { createClasseAction, updateClasseAction } from "../classe.action";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { classeSchema } from "@/src/interfaces/Classe";
import { IOption } from "@/src/interfaces/Option";
import { ICreneau } from "@/src/interfaces/creneau";
import { getCreneauxAction } from "../../creneau/creneau.action";
import { getOptionsAction } from "../../option/option.action";

interface ClasseUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onClasseAction?: () => void;
  initialData?: z.infer<typeof classeSchema>;
  mode: "create" | "update";
}

export function ClasseUpForm({
  className,
  onClasseAction,
  initialData,
  mode,
  ...props
}: ClasseUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [ClasseCreated, setClasseCreated] = useState(false);
  const [Options, setOptions] = useState<IOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [creneaux, setCreneaux] = useState<ICreneau[]>([]);

  const form = useForm<z.infer<typeof classeSchema>>({
    resolver: zodResolver(classeSchema),
    defaultValues: initialData || {
      nameClasse: "",
      codeClasse: "",
      creneauId: "",
      optionId: "",
    },
  });

  useEffect(() => {
    const fecthOptions = async () => {
      const [rawOptions, err] = await getOptionsAction();
      if (err) {
        throw err.message;
      }
      setOptions(rawOptions);
    };
    const fetchCreneau = async () => {
      const [rawCreneaux, err] = await getCreneauxAction();
      if (err) {
        throw err.message;
      }
      setCreneaux(rawCreneaux);
    };
    fetchCreneau();
    fecthOptions();
  }, []);

  const filteredOptions = Options.filter((option) =>
    option.nameOption.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  async function onSubmit(data: z.infer<typeof classeSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [classe, err] = await createClasseAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Classe créée avec succès");
        form.reset();
        onClasseAction?.();
      } else {
        const [classe, err] = await updateClasseAction({
          ...data,
        }); // Action de mise à jour
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Classe mis à jour avec succès");
        form.reset();
        onClasseAction?.();
      }
      setClasseCreated(true);
    } catch (error) {
      console.log(error);
      toast.error(
        mode === "create"
          ? "Échec de la création de la classe"
          : "Échec de la mise à jour de la classe",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="nameClasse"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Nom de la classe</FormLabel>
                  <FormControl>
                    <Input placeholder="Le nom de la classe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="optionId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Le code de l'option</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "justify-between",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value
                            ? Options.find(
                                (option) => option.id === field.value,
                              )?.nameOption
                            : "Entrez le code du option "}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search option..."
                          value={searchTerm}
                          onValueChange={(value: string) =>
                            setSearchTerm(value)
                          }
                        />
                        <CommandList>
                          <CommandEmpty>No option found.</CommandEmpty>
                          <CommandGroup>
                            {Options.map((option) => (
                              <CommandItem
                                value={option.nameOption}
                                key={option.nameOption}
                                onSelect={() => {
                                  form.setValue("optionId", option.id || "");
                                }}
                              >
                                <IconCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    option.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {option.nameOption}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* VACATION */}
            <FormField
              control={form.control}
              name="creneauId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Le code de la vacation</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "justify-between",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value
                            ? creneaux.find(
                                (option) => option.id === field.value,
                              )?.nameCreneau
                            : "Entrez le code de la vacation "}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search option..."
                          value={searchTerm}
                          onValueChange={(value: string) =>
                            setSearchTerm(value)
                          }
                        />
                        <CommandList>
                          <CommandEmpty>No vacation found.</CommandEmpty>
                          <CommandGroup>
                            {creneaux.map((option) => (
                              <CommandItem
                                value={option.nameCreneau}
                                key={option.nameCreneau}
                                onSelect={() => {
                                  form.setValue("creneauId", option.id || "");
                                }}
                              >
                                <IconCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    option.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {option.nameCreneau}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer la classe"
                : "Mettre à jour de la classe"}
            </Button>
            {ClasseCreated}
            {errorMessage && (
              <p className="mt-2 text-center text-red-500">{errorMessage}</p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
