"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCoursOptionPonderationAction,
  updateCoursOptionPonderationAction,
} from "../cours-ponderation-option.action";

type Props = {
  id?: string;
  coursId: string;
  optionId: string;
  defaultPonderation: number;
  onSaved?: (payload: { id?: string; coursId: string; optionId: string; ponderation: number }) => void;
};

export function CoursPonderationOptionForm({
  id,
  coursId,
  optionId,
  defaultPonderation,
  onSaved,
}: Props) {
  const [ponderation, setPonderation] = useState(defaultPonderation);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const payload = { id, coursId, optionId, ponderation };
      const [saved, err] = id
        ? await updateCoursOptionPonderationAction(payload)
        : await createCoursOptionPonderationAction(payload);

      if (err) {
        toast.error(err.message);
        return;
      }

      toast.success("Ponderation enregistree.");
      onSaved?.({
        id: saved?.id ?? id,
        coursId,
        optionId,
        ponderation,
      });
    });
  };

  return (
    <div className="grid gap-2 sm:grid-cols-[120px_auto]">
      <Input
        type="number"
        min={0}
        max={100}
        step={1}
        value={ponderation}
        onChange={(event) => setPonderation(Number(event.target.value))}
        disabled={isPending}
      />
      <Button type="button" variant="outline" onClick={submit} disabled={isPending}>
        {id ? "Modifier" : "Creer"}
      </Button>
    </div>
  );
}

