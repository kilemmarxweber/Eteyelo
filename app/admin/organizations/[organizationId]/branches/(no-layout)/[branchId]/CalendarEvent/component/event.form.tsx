"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  calendarEventSchema,
  Recurrence,
} from "@/src/interfaces/CalendarEvent";
import { createCalendarEvent } from "../CalendarEvent.acton";

import { Button } from "@/components/custom/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EventFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  onEventAction?: () => void;
  initialData?: z.infer<typeof calendarEventSchema>;
  mode: "create" | "update";
  userId: string;
  onSuccess?: () => void;
}

type FormValues = z.infer<typeof calendarEventSchema>;

export function EventForm({
  userId,
  initialData,
  mode,
  onSuccess,
  onEventAction,
  ...props
}: EventFormProps) {
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: initialData ?? {
      title: "",
      location: "",
      description: "",
      allDay: false,
      createdBy: userId,
      recurrence: Recurrence.HEBDOMADAIRE,
      dateStart: new Date(),
      dateEnd: new Date(),
      schoolYearId: "", // IMPORTANT (tu l’avais oublié)
    },
  });

  async function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createCalendarEvent(values);
        } else {
          // await updateCalendarEvent(values);
        }

        form.reset();
        onSuccess?.();
        onEventAction?.();
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
      {...props}
    >
      <Input placeholder="Titre" {...form.register("title")} />

      <Input
        type="datetime-local"
        onChange={(e) => form.setValue("dateStart", new Date(e.target.value))}
      />

      <Input
        type="datetime-local"
        onChange={(e) => form.setValue("dateEnd", new Date(e.target.value))}
      />

      <Input placeholder="Lieu" {...form.register("location")} />

      <Textarea placeholder="Description" {...form.register("description")} />

      <select
        {...form.register("recurrence")}
        className="w-full rounded border p-2"
      >
        {Object.values(Recurrence).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      <Button type="submit" disabled={pending}>
        {pending
          ? "Enregistrement..."
          : mode === "create"
            ? "Créer l'événement"
            : "Mettre à jour l'événement"}
      </Button>
    </form>
  );
}
