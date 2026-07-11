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
import { IconSelector, IconCheck } from "@tabler/icons-react";
import { createOptionAction, updateOptionAction } from "../option.action";
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
import { getSectionsAction } from "../../section/section.action";
import { optionSchema } from "@/src/interfaces/Option";
import { ISection } from "@/src/interfaces/Section";

interface OptionUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof optionSchema>;
  mode: "create" | "update";
}

export function OptionUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  ...props
}: OptionUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [Sections, setSections] = useState<ISection[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<z.infer<typeof optionSchema>>({
    resolver: zodResolver(optionSchema),
    defaultValues: initialData || {
      nameOption: "",
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
    section.nameSection.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSubmit: SubmitHandler<z.infer<typeof optionSchema>> = async (
    data
  ) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [option, err] = await createOptionAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Option créée avec succès");
      } else {
        const [option, err] = await updateOptionAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Option mise à jour avec succès");
      }

      if (mode === "create") {
        form.reset({ nameOption: "", sectionId: "" });
        setSearchTerm("");
        onCreated?.();
      } else {
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error: any) {
      console.log(error);
      setErrorMessage(error.message ?? "");
      toast.error(
        mode === "create"
          ? error.message || "Échec de la création de l'option"
          : error.message || "Échec de la mise à jour de l'option"
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
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="nameOption"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Nom de l'option</FormLabel>
                  <FormControl>
                    <Input placeholder="Le nom de l'option" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sectionId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Le code de la section</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? Sections.find(
                                (section) => section.id === field.value
                              )?.nameSection
                            : "Entrez le code de la section"}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search section..."
                          value={searchTerm}
                          onValueChange={(value: string) =>
                            setSearchTerm(value)
                          }
                        />
                        <CommandList>
                          <CommandEmpty>No section found.</CommandEmpty>
                          <CommandGroup>
                            {filteredSections.map((section) => (
                              <CommandItem
                                value={section.nameSection}
                                key={section.id}
                                onSelect={() => {
                                  form.setValue("sectionId", section.id || "");
                                }}
                              >
                                <IconCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    section.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {section.nameSection}
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
                ? "Enregistrer l'option"
                : "Mettre à jour l'option"}
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

function generateOptionname(nom: string, prenom: string): string {
  return `${nom.toUpperCase()}/${prenom.toUpperCase()}`;
}
