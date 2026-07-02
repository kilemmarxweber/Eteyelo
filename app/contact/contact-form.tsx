"use client";

import { useState } from "react";
import { Mail, Phone, Send, UserRound } from "lucide-react";

type ContactFormProps = {
  partnaire?: string;
};

export default function ContactForm({ partnaire }: ContactFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");

    const formData = new FormData(event.currentTarget);
    const body = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      subject: String(formData.get("subject") || ""),
      message: String(formData.get("message") || ""),
      partnaire,
    };

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      setError(data?.error || "Impossible d'envoyer le message.");
      setStatus("error");
      return;
    }

    event.currentTarget.reset();
    setStatus("sent");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-3xl border bg-white/85 p-5 shadow-xl shadow-blue-950/5 backdrop-blur-xl md:p-7"
    >
      <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-blue-950/10 blur-3xl" />

      {partnaire && (
        <div className="relative mb-5 rounded-2xl border bg-blue-950/10 px-4 py-3 text-sm text-blue-950">
          Message lie au partenaire: <strong>{partnaire}</strong>
        </div>
      )}

      <div className="relative grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Nom complet
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <UserRound className="size-4 text-muted-foreground" />
            <input
              name="name"
              required
              minLength={2}
              placeholder="Votre nom"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        <label className="space-y-2 text-sm font-medium">
          Email
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Mail className="size-4 text-muted-foreground" />
            <input
              name="email"
              required
              type="email"
              placeholder="vous@example.com"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        <label className="space-y-2 text-sm font-medium">
          Telephone
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Phone className="size-4 text-muted-foreground" />
            <input
              name="phone"
              placeholder="+243..."
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        <label className="space-y-2 text-sm font-medium">
          Sujet
          <input
            name="subject"
            required
            minLength={3}
            defaultValue={partnaire ? `Demande concernant ${partnaire}` : ""}
            placeholder="Objet du message"
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          />
        </label>
      </div>

      <label className="relative mt-4 block space-y-2 text-sm font-medium">
        Message
        <textarea
          name="message"
          required
          minLength={10}
          rows={6}
          placeholder="Expliquez-nous votre besoin..."
          className="w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm outline-none"
        />
      </label>

      {status === "sent" && (
        <p className="relative mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
          Message envoye. Nous vous repondrons rapidement.
        </p>
      )}

      {status === "error" && (
        <p className="relative mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="relative mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-950 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-950/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Send className="size-4" />
        {status === "sending" ? "Envoi..." : "Envoyer le message"}
      </button>
    </form>
  );
}
