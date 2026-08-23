"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { IconDownload, IconDeviceFloppy, IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import { BranchLoadingFallback as Loading } from "@/components/branch-loading-fallback";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranchRouteGuard } from "@/hooks/use-branch-route-guard";
import {
  emptyExamExportMeta,
  type ExamExportMeta,
} from "@/lib/exam-export-meta";
import {
  getFinalistesWorkspaceAction,
  listFinalistesAction,
  saveExamExportMetaAction,
} from "../finalistes.action";

type Workspace = {
  canManage: boolean;
  schoolYears: Array<{
    id: string;
    nameYear: string;
    isCurrentYear: boolean;
  }>;
  classes: Array<{
    id: string;
    nameClasse: string;
    codeClasse: string;
  }>;
  meta: ExamExportMeta;
};

type FinalisteRow = {
  numero: number;
  matricule: string;
  fullName: string;
  placeOfBirth: string;
  dateOfBirth: string;
  sexe: string;
  e13: string;
  e80: string;
  fatherName: string;
  motherName: string;
  nationalite: string;
  avenue: string;
  numeroAdresse: string;
  quartier: string;
  commune: string;
  ville: string;
  annee: string;
  ecole: string;
  className?: string;
};

const META_FIELDS: Array<{ key: keyof ExamExportMeta; label: string }> = [
  { key: "province", label: "Province" },
  { key: "provinceCode", label: "Code province" },
  { key: "centre", label: "Centre" },
  { key: "centreCode", label: "Code centre" },
  { key: "etablissement", label: "Établissement" },
  { key: "etablissementCode", label: "Code établissement" },
  { key: "option", label: "Option" },
  { key: "optionCode", label: "Code option" },
  { key: "ordre", label: "Ordre" },
  { key: "gestion", label: "Gestion" },
  { key: "gestionCode", label: "Code gestion" },
];

export function FinalistesClient() {
  useBranchRouteGuard({ routeSuffix: "/finalistes" });

  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [schoolYearId, setSchoolYearId] = useState("");
  const [classeId, setClasseId] = useState("all");
  const [meta, setMeta] = useState<ExamExportMeta>(emptyExamExportMeta());
  const [rows, setRows] = useState<FinalisteRow[]>([]);
  const [session, setSession] = useState("");
  const [classLabel, setClassLabel] = useState("");

  useEffect(() => {
    startTransition(async () => {
      setLoading(true);
      const [result, error] = await getFinalistesWorkspaceAction();
      setLoading(false);
      if (error || !result) {
        toast.error(error?.message ?? "Chargement impossible");
        return;
      }
      setWorkspace({
        canManage: result.canManage,
        schoolYears: result.schoolYears,
        classes: result.classes,
        meta: result.meta,
      });
      setMeta(result.meta);
      const current =
        result.schoolYears.find((year) => year.isCurrentYear) ??
        result.schoolYears[0];
      setSchoolYearId(current?.id ?? "");
    });
  }, []);

  useEffect(() => {
    if (!schoolYearId) {
      setRows([]);
      return;
    }
    startTransition(async () => {
      const [result, error] = await listFinalistesAction({
        schoolYearId,
        classeId: classeId === "all" ? "" : classeId,
      });
      if (error || !result) {
        toast.error(error?.message ?? "Chargement des finalistes impossible");
        return;
      }
      setRows(result.rows as FinalisteRow[]);
      setSession(result.session);
      setClassLabel(result.classLabel);
    });
  }, [schoolYearId, classeId]);

  const missingCodes = useMemo(
    () => rows.filter((row) => !row.e13 && !row.e80).length,
    [rows],
  );

  async function handleSaveMeta() {
    if (!workspace?.canManage) return;
    startTransition(async () => {
      const [result, error] = await saveExamExportMetaAction(meta);
      if (error || !result?.ok) {
        toast.error(error?.message ?? "Enregistrement impossible");
        return;
      }
      toast.success("En-tête du document enregistré");
    });
  }

  async function handleExport() {
    if (!rows.length) {
      toast.error("Aucun finaliste à exporter");
      return;
    }
    try {
      // Chargé seulement au clic — n'alourdit pas l'ouverture de la page.
      const { downloadFinalistesExcel } = await import(
        "../export-finalistes-excel"
      );
      await downloadFinalistesExcel({
        meta,
        session,
        classLabel,
        rows,
      });
      toast.success("Fichier Excel téléchargé");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Export Excel impossible",
      );
    }
  }

  if (loading || !workspace) return <Loading />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Année scolaire</Label>
              <Select value={schoolYearId} onValueChange={setSchoolYearId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir l'année" />
                </SelectTrigger>
                <SelectContent>
                  {workspace.schoolYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.nameYear}
                      {year.isCurrentYear ? " (courante)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Classe finaliste (6è)</Label>
              <Select value={classeId} onValueChange={setClasseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les 6è" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes 6è</SelectItem>
                  {workspace.classes.map((classe) => (
                    <SelectItem key={classe.id} value={classe.id}>
                      {classe.nameClasse}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              {rows.length} finaliste{rows.length > 1 ? "s" : ""}
            </Badge>
            {missingCodes > 0 ? (
              <Badge variant="warning">
                {missingCodes} sans E13/E80
              </Badge>
            ) : null}
            <Button
              type="button"
              onClick={() => void handleExport()}
              disabled={!rows.length || pending}
            >
              <IconDownload className="mr-2 size-4" />
              Exporter Excel
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">En-tête du document</h3>
            {workspace.canManage ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => void handleSaveMeta()}
              >
                <IconDeviceFloppy className="mr-2 size-4" />
                Enregistrer l&apos;en-tête
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {META_FIELDS.map((field) => (
              <div key={field.key} className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  {field.label}
                </Label>
                <Input
                  value={meta[field.key] ?? ""}
                  disabled={!workspace.canManage}
                  onChange={(event) =>
                    setMeta((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="sticky top-0 bg-background text-left shadow-sm">
            <tr>
              <th className="p-2">N°</th>
              <th className="p-2">Matricule</th>
              <th className="p-2">Nom complet</th>
              <th className="p-2">Classe</th>
              <th className="p-2">E13</th>
              <th className="p-2">E80</th>
              <th className="p-2">Sexe</th>
              <th className="p-2">Nationalité</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.matricule}-${row.numero}`} className="border-t">
                <td className="p-2 font-mono text-xs">
                  {String(row.numero).padStart(3, "0")}
                </td>
                <td className="p-2 font-mono text-xs">{row.matricule || "—"}</td>
                <td className="p-2 font-medium">{row.fullName || "—"}</td>
                <td className="p-2 text-muted-foreground">
                  {row.className || classLabel}
                </td>
                <td className="p-2 font-mono text-xs">{row.e13 || "—"}</td>
                <td className="p-2 font-mono text-xs">{row.e80 || "—"}</td>
                <td className="p-2">{row.sexe || "—"}</td>
                <td className="p-2">{row.nationalite || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && !pending ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Aucun élève inscrit en 6è pour cette année. Saisissez les codes
            E13/E80 depuis la liste des élèves.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
