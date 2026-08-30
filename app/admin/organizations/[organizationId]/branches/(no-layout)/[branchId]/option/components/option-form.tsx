"use client";

import { HTMLAttributes, useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
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
import type { TrainingLabelKey } from "@/lib/training-labels";

interface OptionUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof optionSchema>;
  mode: "create" | "update";
  layout?: "default" | "dialog";
  labelKey?: TrainingLabelKey;
}

export function OptionUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  layout = "default",
  labelKey = "school",
  ...props
}: OptionUpFormProps) {
  const tClasses = useTranslations("classes");
  const tCommon = useTranslations("common");
  const tOption = (key: string) => tClasses(`option.${labelKey}.${key}`);
  const isDialog = layout === "dialog";
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sections, setSections] = useState<ISection[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<z.infer<typeof optionSchema>>({
    resolver: zodResolver(optionSchema),
    defaultValues: initialData || {
      nameOption: "",
      sectionId: "",
    },
  });

  useEffect(() => {
    const fetchSections = async () => {
      const [rawSections, err] = await getSectionsAction();
      if (err) return;
      setSections(rawSections);
    };
    void fetchSections();
  }, []);

  const filteredSections = sections.filter((section) =>
    section.nameSection.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const onSubmit: SubmitHandler<z.infer<typeof optionSchema>> = async (
    data,
  ) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [, err] = await createOptionAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success(tOption("created"));
      } else {
        const [, err] = await updateOptionAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success(tOption("updated"));
      }

      if (mode === "create") {
        form.reset({ nameOption: "", sectionId: "" });
        setSearchTerm("");
        onCreated?.();
      } else {
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : tCommon("errorGeneric");
      setErrorMessage(message);
      toast.error(
        mode === "create"
          ? message || tOption("createFail")
          : message || tOption("updateFail"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = isDialog ? "space-y-0.5" : "space-y-1";
  const labelClass = isDialog
    ? "text-xs font-medium text-muted-foreground"
    : undefined;
  const controlClass = isDialog
    ? "h-9 rounded-md px-3 text-sm font-normal"
    : undefined;

  return (
    <div
      className={cn(isDialog ? "grid gap-2" : "grid gap-6", className)}
      {...props}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div
            className={cn(
              "grid",
              isDialog ? "gap-x-4 gap-y-2 sm:grid-cols-2" : "gap-2",
            )}
          >
            <FormField
              control={form.control}
              name="nameOption"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>
                    {tOption("name")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={tOption("namePlaceholder")}
                      className={controlClass}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sectionId"
              render={({ field }) => (
                <FormItem className={cn(fieldClass, "flex flex-col")}>
                  <FormLabel className={labelClass}>
                    {tOption("sectionCol")}
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "justify-between font-normal",
                            controlClass,
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value
                            ? sections.find(
                                (section) => section.id === field.value,
                              )?.nameSection
                            : tOption("chooseSection")}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder={tOption("searchSection")}
                          value={searchTerm}
                          onValueChange={setSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>{tOption("noSection")}</CommandEmpty>
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
                                      : "opacity-0",
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

            {mode === "create" && isDialog ? (
              <p className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground sm:col-span-2">
                {tCommon("codeAutoGenerated")}
              </p>
            ) : null}

            <div className={cn(isDialog && "sm:col-span-2")}>
              <Button
                type="submit"
                size={isDialog ? "default" : undefined}
                className={cn(
                  "mt-2 w-full font-medium",
                  isDialog && "h-11 text-base",
                )}
                loading={isLoading}
              >
                {mode === "create" ? tOption("save") : tOption("update")}
              </Button>
            </div>

            {errorMessage ? (
              <p
                className={cn(
                  "mt-2 text-center text-red-500",
                  isDialog && "sm:col-span-2 text-xs",
                )}
              >
                {errorMessage}
              </p>
            ) : null}
          </div>
        </form>
      </Form>
    </div>
  );
}
