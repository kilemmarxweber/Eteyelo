"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { Mail, Phone, Send, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { sendContactMessageAction } from "./actions";
import { contactSchema, type ContactInput } from "./schema";

type ContactFormProps = {
  recipientId?: string;
  subject?: string;
  partnaire?: string;
  organizationId?: string;
  supportAgent?: string;
  recipientEmail?: string;
  showSupportAgentPicker?: boolean;
  supportAgents?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
};

export default function ContactForm({
  recipientId,
  subject,
  partnaire,
  organizationId,
  supportAgent: initialSupportAgent,
  recipientEmail: initialRecipientEmail,
  showSupportAgentPicker = false,
  supportAgents = [],
}: ContactFormProps) {
  const [pending, startTransition] = useTransition();

  const defaultRecipientId = recipientId ?? initialSupportAgent ?? "";
  const defaultSubject =
    subject ??
    (partnaire ? `Demande de contact - ${partnaire}` : "Demande de contact");
  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      recipientId: defaultRecipientId,
      subject: defaultSubject,
      name: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  function onSubmit(values: ContactInput) {
    startTransition(async () => {
      const res = await sendContactMessageAction({
        ...values,
        recipientId: values.recipientId || defaultRecipientId,
        subject: values.subject || defaultSubject,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success("Message envoyé. Nous vous répondrons rapidement.");

      form.reset({
        recipientId: defaultRecipientId,
        subject: defaultSubject,
        name: "",
        email: "",
        phone: "",
        message: "",
      });
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="relative overflow-hidden rounded-3xl border bg-white/85 p-5 shadow-xl shadow-blue-950/5 backdrop-blur-xl md:p-7"
    >
      <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-blue-950/10 blur-3xl" />

      <input type="hidden" {...form.register("recipientId")} />

      {showSupportAgentPicker && supportAgents.length > 0 ? (
        <label className="relative mb-4 block space-y-2 text-sm font-medium">
          Destinataire
          <select
            {...form.register("recipientId")}
            disabled={pending}
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          >
            <option value="">Choisir un destinataire</option>
            {supportAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} - {agent.email}
              </option>
            ))}
          </select>
          <FormError message={form.formState.errors.recipientId?.message} />
        </label>
      ) : null}

      <div className="relative grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Nom complet
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <UserRound className="size-4 text-muted-foreground" />
            <input
              {...form.register("name")}
              disabled={pending}
              required
              minLength={2}
              placeholder="Votre nom"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <FormError message={form.formState.errors.name?.message} />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Email
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Mail className="size-4 text-muted-foreground" />
            <input
              {...form.register("email")}
              disabled={pending}
              type="email"
              placeholder="vous@example.com"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <FormError message={form.formState.errors.email?.message} />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Téléphone
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Phone className="size-4 text-muted-foreground" />
            <input
              {...form.register("phone")}
              disabled={pending}
              placeholder="+243..."
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <FormError message={form.formState.errors.phone?.message} />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Sujet
          <input
            {...form.register("subject")}
            disabled={pending}
            placeholder="Objet du message"
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          />
          <FormError message={form.formState.errors.subject?.message} />
        </label>
      </div>

      <label className="relative mt-4 block space-y-2 text-sm font-medium">
        Message
        <textarea
          {...form.register("message")}
          disabled={pending}
          rows={6}
          placeholder="Expliquez-nous votre besoin..."
          className="w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm outline-none"
        />
        <FormError message={form.formState.errors.message?.message} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="relative mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-950/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Send className="size-4" />
        {pending ? "Envoi..." : "Envoyer le message"}
      </button>
    </form>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-xs text-red-600">{message}</p>;
}
