"use client";

import { useState, useTransition } from "react";
import {
  School,
  User,
  GraduationCap,
  Mail,
  Phone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerStudentOnline } from "./insption.actions";
import { HomeNavbar } from "@/components/home-navbar";

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
    <main className="min-h-screen bg-slate-50">
      <HomeNavbar />
      <section className="mx-auto -mt-0 max-w-6xl px-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.4fr]">
          <aside className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-950 text-white">
                <Sparkles className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-xl font-black text-blue-950">
                  Étapes rapides
                </h2>
                <p className="text-sm text-slate-500">
                  Simple, rapide et sécurisé.
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {[
                ["1", "Choisir l’école"],
                ["2", "Ajouter le parent"],
                ["3", "Ajouter l’élève"],
                ["4", "Envoyer la demande"],
              ].map(([number, title]) => (
                <div
                  key={number}
                  className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-700 text-sm font-black text-white">
                    {number}
                  </span>
                  <span className="font-bold text-blue-950">{title}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/10 sm:p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-black text-blue-950">
                Formulaire d’inscription
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Les champs marqués avec * sont obligatoires.
              </p>
            </div>

            <div className="grid gap-6">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-950">
                  <School className="h-4 w-4" />
                  École *
                </label>

                <select
                  value={form.branchId}
                  onChange={(e) => update("branchId", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-blue-100 bg-blue-50/60 px-4 text-sm outline-none ring-blue-600 focus:ring-2"
                >
                  <option value="">Choisir une école</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} — {branch.ville || branch.pays || "RDC"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-blue-950">
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
                      placeholder="Téléphone du parent"
                      value={form.parentPhone}
                      onChange={(e) => update("parentPhone", e.target.value)}
                      className="h-12 rounded-2xl pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-blue-50/70 p-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-blue-950">
                  <GraduationCap className="h-5 w-5" />
                  Informations de l’élève
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    placeholder="Nom de l’élève *"
                    value={form.studentName}
                    onChange={(e) => update("studentName", e.target.value)}
                    className="h-12 rounded-2xl"
                  />

                  <Input
                    type="email"
                    placeholder="Email de l’élève"
                    value={form.studentEmail}
                    onChange={(e) => update("studentEmail", e.target.value)}
                    className="h-12 rounded-2xl"
                  />

                  <Input
                    placeholder="Téléphone de l’élève"
                    value={form.studentPhone}
                    onChange={(e) => update("studentPhone", e.target.value)}
                    className="h-12 rounded-2xl"
                  />

                  <Input
                    placeholder="Provenance de l’école"
                    value={form.provenanceEcole}
                    onChange={(e) => update("provenanceEcole", e.target.value)}
                    className="h-12 rounded-2xl"
                  />

                  <Input
                    placeholder="Classe supposée"
                    value={form.suppositionClasseName}
                    onChange={(e) =>
                      update("suppositionClasseName", e.target.value)
                    }
                    className="h-12 rounded-2xl"
                  />

                  <Input
                    placeholder="Section supposée"
                    value={form.suppositionSection}
                    onChange={(e) =>
                      update("suppositionSection", e.target.value)
                    }
                    className="h-12 rounded-2xl"
                  />

                  <Input
                    placeholder="Option supposée"
                    value={form.suppositionOption}
                    onChange={(e) =>
                      update("suppositionOption", e.target.value)
                    }
                    className="h-12 rounded-2xl sm:col-span-2"
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="h-14 rounded-full bg-gradient-to-r from-blue-700 via-cyan-500 to-blue-700 text-base font-black text-white shadow-[0_0_30px_rgba(34,211,238,.35)] transition hover:scale-[1.01] hover:shadow-[0_0_45px_rgba(34,211,238,.65)]"
              >
                {isPending ? "Envoi en cours..." : "Envoyer l’inscription"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
