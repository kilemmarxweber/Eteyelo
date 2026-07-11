"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCoursOptionPonderationAction,
  updateCoursOptionPonderationAction,
} from "../cours-ponderation-option.action";

type PonderationPayload = {
  id?: string;
  coursId: string;
  optionId: string;
  ponderation: number;
};

type Props = {
  id?: string;
  coursId: string;
  optionId: string;
  defaultPonderation: number;
  onCreated?: (payload: PonderationPayload) => void;
  onUpdated?: (payload: PonderationPayload) => void;
  onSuccess?: (payload: PonderationPayload) => void;
};

export function CoursPonderationOptionForm({
  id,
  coursId,
  optionId,
  defaultPonderation,
  onCreated,
  onUpdated,
  onSuccess,
}: Props) {
  const [ponderation, setPonderation] = useState(defaultPonderation);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const input = { id, coursId, optionId, ponderation };
      const [saved, err] = id
        ? await updateCoursOptionPonderationAction(input)
        : await createCoursOptionPonderationAction(input);

      if (err) {
        toast.error(err.message);
        return;
      }

      toast.success("Ponderation enregistree.");
      const payload = {
        id: saved?.id ?? id,
        coursId,
        optionId,
        ponderation,
      };
      if (id) {
        onUpdated?.(payload);
      } else {
        onCreated?.(payload);
      }
      onSuccess?.(payload);
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

