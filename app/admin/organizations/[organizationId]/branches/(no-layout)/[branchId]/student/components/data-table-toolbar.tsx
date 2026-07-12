"use client";

import { useState } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";
import {
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
import { exportStudentsReportPdf } from "./export-students-pdf";
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

export function DataTableToolbar<TData>({
  table,
  canManageStudents = true,
}: DataTableToolbarProps<TData>) {
  const [exportingPdf, setExportingPdf] = useState(false);
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
  const exportFilteredPdf = async () => {
    const filteredStudents = table
      .getFilteredRowModel()
      .rows.map((row) => row.original as IStudent);
    const classFilterValue = table
      .getColumn("classCode")
      ?.getFilterValue();
    const selectedClassCodes = Array.isArray(classFilterValue)
      ? classFilterValue.map(String)
      : [];
    const selectedClassCode =
      selectedClassCodes.length === 1 ? selectedClassCodes[0] : null;
    const selectedClassStudent = selectedClassCode
      ? table
          .getPreFilteredRowModel()
          .rows.map((row) => row.original as IStudent)
          .find((student) => student.classCode === selectedClassCode)
      : null;

    setExportingPdf(true);
    try {
      const [context, error] = await getStudentReportContextAction();
      if (error || !context) {
        throw new Error(
          error?.message || "Impossible de charger les informations du rapport.",
        );
      }

      await exportStudentsReportPdf(filteredStudents, context, {
        selectedClass: selectedClassCode
          ? {
              code: selectedClassCode,
              name: selectedClassStudent?.className || selectedClassCode,
            }
          : null,
      });
      toast.success("Le rapport PDF des eleves a ete genere.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de generer le rapport PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-blue-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-[300px]">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-blue-950/40" />

        <Input
          placeholder="Rechercher par nom ou matricule..."
          value={(table.getColumn("nom")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("nom")?.setFilterValue(event.target.value)
          }
          className="h-11 rounded-xl border-blue-100 bg-white pl-9 text-blue-950 placeholder:text-blue-950/40 focus-visible:ring-blue-200"
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
          leftSection={<IconFileTypePdf size={16} />}
          onClick={exportFilteredPdf}
          loading={exportingPdf}
          disabled={!table.getFilteredRowModel().rows.length || exportingPdf}
        >
          {exportingPdf ? "Generation..." : "Rapport PDF"}
        </Button>

        {isFiltered ? (
          <Button
            variant="outline"
            onClick={() => table.resetColumnFilters()}
            className="h-10 border-blue-100 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
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
  );
}
