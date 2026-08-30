"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createCoursComponentAction,
  deleteCoursComponentAction,
  getCoursComponentsAction,
  updateCoursComponentAction,
} from "../cours.action";
import type { ICours } from "@/src/interfaces/Cours";

export function CoursComponentsPanel({
  parentCoursId,
  parentName,
}: {
  parentCoursId: string;
  parentName: string;
}) {
  const t = useTranslations("teaching.courses.components");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<ICours[]>([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);

  async function reload() {
    const [data, error] = await getCoursComponentsAction({ parentCoursId });
    if (error) {
      toast.error(error.message ?? t("loadFailed"));
      return;
    }
    setRows(data ?? []);
  }

  useEffect(() => {
    void reload();
  }, [parentCoursId]);

  async function addComponent() {
    const name = label.trim();
    if (name.length < 2) {
      toast.error(t("nameTooShort"));
      return;
    }
    setLoading(true);
    const [, error] = await createCoursComponentAction({
      parentCoursId,
      nameCours: name,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? t("createFailed"));
      return;
    }
    setLabel("");
    toast.success(t("added"));
    await reload();
  }

  async function removeComponent(id: string) {
    setLoading(true);
    const [, error] = await deleteCoursComponentAction({ id });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? t("deleteFailed"));
      return;
    }
    toast.success(t("deleted"));
    await reload();
  }

  async function renameComponent(id: string, nameCours: string) {
    const [, error] = await updateCoursComponentAction({
      id,
      parentCoursId,
      nameCours,
    });
    if (error) {
      toast.error(error.message ?? t("updateFailed"));
      await reload();
      return;
    }
    toast.success(t("updated"));
    await reload();
  }

  return (
    <div className="w-full min-w-0 space-y-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("title")}</p>
          <p className="text-xs text-muted-foreground">
            {t("desc", { parent: parentName })}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {t("badge")}
        </Badge>
      </div>

      <div className="flex min-w-0 gap-2">
        <Input
          className="min-w-0 flex-1"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("placeholder")}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addComponent();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={loading}
          onClick={() => void addComponent()}
        >
          <IconPlus className="mr-1 size-4" />
          {t("add")}
        </Button>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/20 p-2"
          >
            <Input
              className="h-8 min-w-0 flex-1"
              defaultValue={row.nameCours}
              key={`${row.id}-${row.nameCours}`}
              disabled={loading}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (!next || next === row.nameCours) return;
                void renameComponent(row.id, next);
              }}
            />
            <span className="max-w-[6rem] shrink-0 truncate text-xs text-muted-foreground">
              {row.codeCours}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0 text-destructive"
              disabled={loading}
              title={t("deleteTitle")}
              onClick={() => void removeComponent(row.id)}
            >
              <IconTrash className="size-4" />
            </Button>
          </li>
        ))}
        {!rows.length ? (
          <li className="text-xs text-muted-foreground">{t("empty")}</li>
        ) : null}
      </ul>
    </div>
  );
}
