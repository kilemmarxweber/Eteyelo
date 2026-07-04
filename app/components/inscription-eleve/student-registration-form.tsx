"use client";

import { useState, useTransition } from "react";
import {
  BadgeCheck,
  GraduationCap,
  Mail,
  Phone,
  School,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HomeNavbar } from "@/components/home-navbar";

import { registerStudentOnline } from "./insption.actions";

type Branch = {
  id: string;
  name: string;
  ville: string | null;
  pays: string | null;
  image: string | null;
};

export function StudentRegistrationForm({ branches }: { branches: Branch[] }) {
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    branchId: "",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    studentName: "",
    studentEmail: "",
    studentPhone: "",
    provenanceEcole: "",
    suppositionClasseName: "",
    suppositionSection: "",
    suppositionOption: "",
  });

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    startTransition(async () => {
      const res = await registerStudentOnline(form);

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);

      setForm({
        branchId: "",
        parentName: "",
        parentEmail: "",
        parentPhone: "",
        studentName: "",
        studentEmail: "",
        studentPhone: "",
        provenanceEcole: "",
        suppositionClasseName: "",
        suppositionSection: "",
        suppositionOption: "",
      });
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <HomeNavbar />

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-between rounded-3xl bg-blue-950 p-7 text-white shadow-2xl shadow-blue-950/10 md:p-9">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
              <GraduationCap className="size-4" />
              Inscription eleve
            </div>

            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Envoyez une demande d'inscription scolaire
            </h1>

            <p className="mt-4 max-w-[430px] text-sm leading-7 text-blue-50 md:text-base">
              Selectionnez l'etablissement, ajoutez les informations du parent
              et de l'eleve, puis l'ecole pourra traiter la demande depuis son
              espace.
            </p>
          </div>

          <div className="mt-10 grid gap-3 text-sm">
            {[
              ["1", "Choisir l'ecole"],
              ["2", "Ajouter le parent"],
              ["3", "Ajouter l'eleve"],
              ["4", "Envoyer la demande"],
            ].map(([number, title]) => (
              <div
                key={number}
                className="flex items-center gap-3 rounded-2xl bg-white/10 p-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-950">
                  {number}
                </span>
                <span>{title}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-7">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-950 text-white">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Formulaire d'inscription
              </h2>
              <p className="text-sm text-slate-500">
                Les champs marques avec * sont obligatoires.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-6">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <School className="h-4 w-4" />
                Ecole *
              </label>

              <select
                value={form.branchId}
                onChange={(e) => update("branchId", e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none ring-blue-950/20 focus:ring-2"
              >
                <option value="">Choisir une ecole</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} - {branch.ville || branch.pays || "RDC"}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t pt-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950">
                <User className="h-5 w-5" />
                Informations du parent
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  placeholder="Nom du parent *"
                  value={form.parentName}
                  onChange={(e) => update("parentName", e.target.value)}
                  className="h-12 rounded-2xl"
                />

                <div className="relative">
                  <Mail className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="Email du parent *"
                    value={form.parentEmail}
                    onChange={(e) => update("parentEmail", e.target.value)}
                    className="h-12 rounded-2xl pl-10"
                  />
                </div>

                <div className="relative sm:col-span-2">
                  <Phone className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Telephone du parent"
                    value={form.parentPhone}
                    onChange={(e) => update("parentPhone", e.target.value)}
                    className="h-12 rounded-2xl pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950">
                <BadgeCheck className="h-5 w-5" />
                Informations de l'eleve
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  placeholder="Nom de l'eleve *"
                  value={form.studentName}
                  onChange={(e) => update("studentName", e.target.value)}
                  className="h-12 rounded-2xl"
                />

                <Input
                  type="email"
                  placeholder="Email de l'eleve"
                  value={form.studentEmail}
                  onChange={(e) => update("studentEmail", e.target.value)}
                  className="h-12 rounded-2xl"
                />

                <Input
                  placeholder="Telephone de l'eleve"
                  value={form.studentPhone}
                  onChange={(e) => update("studentPhone", e.target.value)}
                  className="h-12 rounded-2xl"
                />

                <Input
                  placeholder="Ecole de provenance"
                  value={form.provenanceEcole}
                  onChange={(e) => update("provenanceEcole", e.target.value)}
                  className="h-12 rounded-2xl"
                />

                <Input
                  placeholder="Classe supposee"
                  value={form.suppositionClasseName}
                  onChange={(e) =>
                    update("suppositionClasseName", e.target.value)
                  }
                  className="h-12 rounded-2xl"
                />

                <Input
                  placeholder="Section supposee"
                  value={form.suppositionSection}
                  onChange={(e) => update("suppositionSection", e.target.value)}
                  className="h-12 rounded-2xl"
                />

                <Input
                  placeholder="Option supposee"
                  value={form.suppositionOption}
                  onChange={(e) => update("suppositionOption", e.target.value)}
                  className="h-12 rounded-2xl sm:col-span-2"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="h-14 rounded-full bg-blue-950 text-base font-semibold text-white hover:bg-blue-900"
            >
              <Send className="mr-2 size-4" />
              {isPending ? "Envoi en cours..." : "Envoyer l'inscription"}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
