"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { IconAdjustments } from "@tabler/icons-react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getCoursPonderationOptionPageDataAction,
} from "./cours-ponderation-option.action";
import { CoursPonderationOptionForm } from "./components/cours-ponderation-option-form";

type OptionItem = {
  id: string;
  nameOption: string;
  codeOption: string | null;
};

type CoursItem = {
  id: string;
  nameCours: string;
  codeCours: string;
};

type PonderationItem = {
  id: string;
  coursId: string;
  optionId: string;
  ponderation: number;
};

export default function CoursPonderationOptionPage() {
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [cours, setCours] = useState<CoursItem[]>([]);
  const [ponderations, setPonderations] = useState<PonderationItem[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [data, err] = await getCoursPonderationOptionPageDataAction();

      if (err) {
        toast.error(err.message);
        return;
      }

      setOptions(data.options);
      setCours(data.cours);
      setPonderations(data.ponderations);
      setSelectedOptionId((current) => current || data.options[0]?.id || "");
    });
  }, []);

  const ponderationMap = useMemo(
    () =>
      new Map(
        ponderations.map((item) => [
          `${item.optionId}:${item.coursId}`,
          item,
        ]),
      ),
    [ponderations],
  );

  const upsertLocal = (payload: {
    id?: string;
    coursId: string;
    optionId: string;
    ponderation: number;
  }) => {
    setPonderations((current) => {
      const key = `${payload.optionId}:${payload.coursId}`;
      const exists = current.some((item) => `${item.optionId}:${item.coursId}` === key);

      if (exists) {
        return current.map((item) =>
          `${item.optionId}:${item.coursId}` === key
            ? { ...item, id: payload.id ?? item.id, ponderation: payload.ponderation }
            : item,
        );
      }

      if (!payload.id) return current;

      return [
        ...current,
        {
          id: payload.id,
          coursId: payload.coursId,
          optionId: payload.optionId,
          ponderation: payload.ponderation,
        },
      ];
    });
  };

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Ponderation cours par option"
          description="Configurez la ponderation de chaque cours selon l'option."
          badge={
            <Badge variant="outline-primary" icon={<IconAdjustments size={14} />}>
              Enseignement
            </Badge>
          }
        />

        <Card className="space-y-4 rounded-md border p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Option</h2>
              <p className="text-sm text-muted-foreground">
                Selectionnez une option pour modifier les ponderations.
              </p>
            </div>
            <select
              value={selectedOptionId}
              onChange={(event) => setSelectedOptionId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              disabled={isPending}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nameOption}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3">
            {cours.map((item) => {
              const ponderation = ponderationMap.get(`${selectedOptionId}:${item.id}`);

              return (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_260px] md:items-center"
                >
                  <div>
                    <p className="font-medium text-slate-950">{item.nameCours}</p>
                    <p className="text-xs text-muted-foreground">{item.codeCours}</p>
                  </div>
                  {selectedOptionId ? (
                    <CoursPonderationOptionForm
                      key={`${selectedOptionId}:${item.id}`}
                      id={ponderation?.id}
                      coursId={item.id}
                      optionId={selectedOptionId}
                      defaultPonderation={ponderation?.ponderation ?? 1}
                      onSaved={upsertLocal}
                    />
                  ) : null}
                </div>
              );
            })}

            {!cours.length && (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Aucun cours disponible.
              </p>
            )}
          </div>
        </Card>
      </LayoutBody>
    </Layout>
  );
}
