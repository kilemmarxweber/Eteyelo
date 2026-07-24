"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { uploadFile } from "@/lib/upload-file";
import { libraryBookMetaSchema } from "@/lib/library/schemas";
import {
  getLibraryTaxonomy,
  type LibraryCycleCode,
} from "@/lib/library/taxonomy";
import type { LibraryBookListItem } from "../bibliotheque-client";

const formSchema = libraryBookMetaSchema;

type FormValues = z.infer<typeof formSchema>;

type BookFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  typebranch: string;
  initialData?: LibraryBookListItem;
  onSuccess?: () => void;
};

export function BookFormDialog({
  open,
  onOpenChange,
  mode,
  typebranch,
  initialData,
  onSuccess,
}: BookFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const taxonomy = getLibraryTaxonomy(typebranch);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      author: "",
      publisher: "",
      description: "",
      coverImage: null,
      cycle: taxonomy.defaultCycle,
      level: "",
      section: "",
      subject: "",
      category: "",
      language: "fr",
      license: "",
      isbn: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    setBookFile(null);
    setCoverFile(null);
    if (mode === "edit" && initialData) {
      form.reset({
        title: initialData.title,
        author: initialData.author ?? "",
        publisher: initialData.publisher ?? "",
        description: initialData.description ?? "",
        coverImage: initialData.coverImage,
        cycle: initialData.cycle,
        level: initialData.level ?? "",
        section: initialData.section ?? "",
        subject: initialData.subject ?? "",
        category: initialData.category ?? "",
        language: initialData.language || "fr",
        license: "",
        isbn: "",
        isActive: initialData.isActive ?? true,
      });
    } else {
      form.reset({
        title: "",
        author: "",
        publisher: "",
        description: "",
        coverImage: null,
        cycle: taxonomy.defaultCycle,
        level: "",
        section: "",
        subject: "",
        category: "",
        language: "fr",
        license: "",
        isbn: "",
        isActive: true,
      });
    }
  }, [open, mode, initialData, form, taxonomy.defaultCycle]);

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    try {
      let coverImage = values.coverImage ?? null;
      if (coverFile) {
        const uploaded = await uploadFile(coverFile);
        if (!uploaded.ok) {
          throw new Error(uploaded.message);
        }
        coverImage = uploaded.url;
      }

      if (mode === "create") {
        if (!bookFile) {
          throw new Error("Sélectionnez un fichier PDF ou EPUB.");
        }

        const formData = new FormData();
        formData.append("file", bookFile);
        formData.append("title", values.title);
        if (values.author) formData.append("author", values.author);
        if (values.publisher) formData.append("publisher", values.publisher);
        if (values.description) formData.append("description", values.description);
        if (coverImage) formData.append("coverImage", coverImage);
        if (values.cycle) formData.append("cycle", values.cycle);
        if (values.level) formData.append("level", values.level);
        if (values.section) formData.append("section", values.section);
        if (values.subject) formData.append("subject", values.subject);
        if (values.category) formData.append("category", values.category);
        formData.append("language", values.language || "fr");
        if (values.license) formData.append("license", values.license);
        if (values.isbn) formData.append("isbn", values.isbn);
        formData.append("isActive", String(values.isActive ?? true));

        const response = await fetch("/api/library/books", {
          method: "POST",
          body: formData,
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Échec de la création.");
        }

        toast.success("Livre ajouté à la bibliothèque");
      } else if (initialData?.id) {
        const formData = new FormData();
        formData.append("title", values.title);
        if (values.author) formData.append("author", values.author);
        if (values.publisher) formData.append("publisher", values.publisher);
        if (values.description) formData.append("description", values.description);
        if (coverImage) formData.append("coverImage", coverImage);
        if (values.cycle) formData.append("cycle", values.cycle);
        if (values.level) formData.append("level", values.level);
        if (values.section) formData.append("section", values.section);
        if (values.subject) formData.append("subject", values.subject);
        if (values.category) formData.append("category", values.category);
        formData.append("language", values.language || "fr");
        if (values.license) formData.append("license", values.license);
        if (values.isbn) formData.append("isbn", values.isbn);
        formData.append("isActive", String(values.isActive ?? true));
        if (bookFile) {
          formData.append("file", bookFile);
        }

        const response = await fetch(`/api/library/books/${initialData.id}`, {
          method: "PATCH",
          body: formData,
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
          fileReplaced?: boolean;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Échec de la mise à jour.");
        }

        toast.success(
          result.fileReplaced
            ? "Livre et fichier mis à jour"
            : "Livre mis à jour",
        );
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        size="md"
        className="flex max-h-[min(94dvh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(90dvh,42rem)]"
      >
        <ResponsiveDialogHeader className="border-b px-4 py-3 text-left sm:px-6 sm:py-4">
          <ResponsiveDialogTitle>
            {mode === "create" ? "Ajouter un livre" : "Modifier le livre"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Lecture seule réservée aux {taxonomy.readerPluralLower}. Aucun
            téléchargement.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <Form {...form}>
            <form
              id="library-book-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-4"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex. Mathématiques 6ème" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="author"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auteur</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Auteur"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="publisher"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Éditeur</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Éditeur"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Résumé pédagogique…"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cycle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cycle</FormLabel>
                      <Select
                        value={field.value ?? undefined}
                        onValueChange={(value) =>
                          field.onChange(value as LibraryCycleCode)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taxonomy.cycles.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Niveau</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taxonomy.levels.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matière</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taxonomy.subjects.map((subject) => (
                            <SelectItem key={subject} value={subject}>
                              {subject}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="section"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Section</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Optionnel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taxonomy.sections.map((section) => (
                            <SelectItem key={section.value} value={section.value}>
                              {section.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>
                  {mode === "create"
                    ? "Fichier livre (PDF ou EPUB, max 50 Mo)"
                    : "Remplacer le fichier livre (optionnel)"}
                </FormLabel>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm transition hover:border-primary/40 hover:bg-muted/60">
                  <Upload className="size-5 text-muted-foreground" />
                  <span className="text-center text-muted-foreground">
                    {bookFile
                      ? bookFile.name
                      : mode === "create"
                        ? "Cliquez pour sélectionner un fichier"
                        : initialData?.fileType
                          ? `Fichier actuel : ${initialData.fileType} — cliquez pour le remplacer`
                          : "Cliquez pour remplacer le PDF ou EPUB"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.epub,application/pdf,application/epub+zip"
                    className="hidden"
                    onChange={(e) =>
                      setBookFile(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
                {mode === "edit" && !bookFile ? (
                  <p className="text-xs text-muted-foreground">
                    Laissez vide pour conserver le fichier actuel.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <FormLabel>Couverture (optionnel)</FormLabel>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <FormLabel className="m-0">
                      Actif pour les {taxonomy.readerPluralLower}
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <ResponsiveDialogFooter className="gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="library-book-form"
            className="w-full sm:w-auto"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enregistrement…
              </>
            ) : mode === "create" ? (
              "Publier"
            ) : (
              "Enregistrer"
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
