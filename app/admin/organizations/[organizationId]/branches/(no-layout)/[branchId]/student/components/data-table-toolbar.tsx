"use client";

import { useState } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";
import {
  IconEye,
  IconFilter,
  IconFileTypePdf,
  IconKey,
  IconSearch,
  IconUpload,
} from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { Input } from "@/components/ui/input";
import type { IStudent } from "@/src/interfaces/Student";
import type { SchoolReportContext } from "@/lib/reports/types";
import {
  exportStudentsReportPdf,
  type StudentReportOptions,
  type StudentReportSexe,
} from "./export-students-pdf";
import { StudentsListPreviewDialog } from "./students-list-preview-dialog";
import { getStudentReportContextAction } from "../student.action";
import { toast } from "sonner";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  canManageStudents?: boolean;
}

const sexes = [
  {
    label: "Masculin",
    value: "M",
  },
  {
    label: "Féminin",
    value: "F",
  },
];

function readFilterValues(
  value: unknown,
): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim() && value !== "all") {
    return [value];
  }
  return [];
}

function resolveReportOptions(table: Table<unknown>): StudentReportOptions {
  const classFilterValue = table.getColumn("classCode")?.getFilterValue();
  const selectedClassCodes = readFilterValues(classFilterValue);
  const selectedClassCode =
    selectedClassCodes.length === 1 ? selectedClassCodes[0] : null;
  const selectedClassStudent = selectedClassCode
    ? table
        .getPreFilteredRowModel()
        .rows.map((row) => row.original as IStudent)
        .find((student) => student.classCode === selectedClassCode)
    : null;

  const sexeValues = readFilterValues(
    table.getColumn("sexe")?.getFilterValue(),
  );
  const sexe =
    sexeValues.length === 1 && (sexeValues[0] === "M" || sexeValues[0] === "F")
      ? (sexeValues[0] as StudentReportSexe)
      : null;

  return {
    selectedClass: selectedClassCode
      ? {
          code: selectedClassCode,
          name: selectedClassStudent?.className || selectedClassCode,
        }
      : null,
    sexe,
  };
}

export function DataTableToolbar<TData>({
  table,
  canManageStudents = true,
}: DataTableToolbarProps<TData>) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContext, setPreviewContext] =
    useState<SchoolReportContext | null>(null);
  const [previewStudents, setPreviewStudents] = useState<IStudent[]>([]);
  const [previewOptions, setPreviewOptions] = useState<StudentReportOptions>(
    {},
  );
  const isFiltered = table.getState().columnFilters.length > 0;
  const classOptions = Array.from(
    new Map(
      table.getPreFilteredRowModel().rows
        .map((row) => {
          const original = row.original as {
            classCode?: string | null;
            className?: string | null;
          };
          return original.classCode
            ? [
                original.classCode,
                {
                  value: original.classCode,
                  label: original.className
                    ? `${original.classCode} — ${original.className}`
                    : original.classCode,
                },
              ] as const
            : null;
        })
        .filter((item): item is readonly [string, { value: string; label: string }] => Boolean(item)),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, "fr"));

  const loadReportPayload = async () => {
    const filteredStudents = table
      .getFilteredRowModel()
      .rows.map((row) => row.original as IStudent);
    const options = resolveReportOptions(table as Table<unknown>);
    const [context, error] = await getStudentReportContextAction();
    if (error || !context) {
      throw new Error(
        error?.message || "Impossible de charger les informations du rapport.",
      );
    }
    return { filteredStudents, context, options };
  };

  const exportFilteredPdf = async () => {
    setExportingPdf(true);
    try {
      const { filteredStudents, context, options } = await loadReportPayload();
      await exportStudentsReportPdf(filteredStudents, context, options);
      toast.success("Le rapport PDF des élèves a été généré.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de générer le rapport PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const openListPreview = async () => {
    setPreviewLoading(true);
    try {
      const { filteredStudents, context, options } = await loadReportPayload();
      setPreviewStudents(filteredStudents);
      setPreviewContext(context);
      setPreviewOptions(options);
      setPreviewOpen(true);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d'ouvrir l'aperçu de la liste.",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const hasRows = table.getFilteredRowModel().rows.length > 0;

  return (
    <>
      <div className="flex flex-col gap-3 border-b border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-[300px]">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />

          <Input
            placeholder="Rechercher par nom ou matricule..."
            value={(table.getColumn("nom")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("nom")?.setFilterValue(event.target.value)
            }
            className="h-11 rounded-xl border bg-card pl-9 text-foreground placeholder:text-foreground/40 focus-visible:ring-blue-200"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {table.getColumn("classCode") && classOptions.length ? (
            <DataTableFacetedFilter
              column={table.getColumn("classCode")}
              title="Classe"
              options={classOptions}
              value="all"
              onValueChange={() => undefined}
            />
          ) : null}

          {table.getColumn("sexe") ? (
            <DataTableFacetedFilter
              column={table.getColumn("sexe")}
              title="Sexe"
              options={sexes}
              value={
                (table.getColumn("sexe")?.getFilterValue() as string) ?? "all"
              }
              onValueChange={(value) =>
                table
                  .getColumn("sexe")
                  ?.setFilterValue(value === "all" ? "" : value)
              }
            />
          ) : null}

          <Button variant="outline" leftSection={<IconFilter size={16} />}>
            Filtres
          </Button>

          <Button
            variant="outline"
            leftSection={<IconEye size={16} />}
            onClick={openListPreview}
            loading={previewLoading}
            disabled={!hasRows || previewLoading || exportingPdf}
          >
            {previewLoading ? "Chargement..." : "Aperçu liste"}
          </Button>

          <Button
            variant="outline"
            leftSection={<IconFileTypePdf size={16} />}
            onClick={exportFilteredPdf}
            loading={exportingPdf}
            disabled={!hasRows || exportingPdf || previewLoading}
          >
            {exportingPdf ? "Génération..." : "Rapport PDF"}
          </Button>

          {isFiltered ? (
            <Button
              variant="outline"
              onClick={() => table.resetColumnFilters()}
              className="h-10 border-border text-primary hover:bg-blue-50 hover:text-blue-800"
            >
              Réinitialiser
              <Cross2Icon className="ml-2 size-4" />
            </Button>
          ) : null}

          {canManageStudents ? (
            <>
              <Button variant="outline" leftSection={<IconUpload size={16} />}>
                Importer
              </Button>

              <Button variant="outline" leftSection={<IconKey size={16} />}>
                Générer logins
              </Button>
            </>
          ) : null}

          <DataTableViewOptions table={table} />
        </div>
      </div>

      <StudentsListPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        students={previewStudents}
        context={previewContext}
        options={previewOptions}
      />
    </>
  );
}
