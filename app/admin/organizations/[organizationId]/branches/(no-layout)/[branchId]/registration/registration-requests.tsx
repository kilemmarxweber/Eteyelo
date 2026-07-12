"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Bell, CheckCircle2, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmRegistrationRequestAction, getPendingRegistrationRequestsAction } from "./registration.action";

export function RegistrationRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState("");
  const router = useRouter();
  const params = useParams<{ organizationId: string; branchId: string }>();

  useEffect(() => { void (async () => {
    const [data, error] = await getPendingRegistrationRequestsAction();
    if (error) return toast.error(error.message);
    setRequests(data ?? []);
  })(); }, []);

  async function continueRequest(request: any) {
    setLoadingId(request.id);
    if (request.status === "PENDING") {
      const [, error] = await confirmRegistrationRequestAction({ requestId: request.id });
      if (error) { setLoadingId(""); return toast.error(error.message); }
    }
    router.push(`/admin/organizations/${params.organizationId}/branches/${params.branchId}/registration?requestId=${request.id}`);
    router.refresh();
  }

  if (!requests.length) return null;
  return <Card className="border-blue-200 bg-blue-50/50"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Bell className="size-4" />Demandes en attente<Badge>{requests.length}</Badge></CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2">{requests.map((request) => {
    const student = request.studentData as Record<string, string>;
    const guardians = request.guardiansData as Array<Record<string, string>>;
    return <div key={request.id} className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-semibold">{student.name} {student.postnom} {student.prenom}</p><p className="text-xs text-muted-foreground">{request.reference} · {request.requestedLevel || "Niveau non precise"}</p><p className="text-xs text-muted-foreground">Responsable : {guardians[0]?.name || "-"} · {new Date(request.createdAt).toLocaleDateString("fr-FR")}</p></div><Button type="button" size="sm" onClick={() => continueRequest(request)} disabled={loadingId === request.id}>{request.status === "CONFIRMED" ? <CheckCircle2 className="mr-2 size-4" /> : <Clock3 className="mr-2 size-4" />}{loadingId === request.id ? "Ouverture..." : request.status === "CONFIRMED" ? "Continuer" : "Confirmer"}</Button></div>;
  })}</CardContent></Card>;
}
