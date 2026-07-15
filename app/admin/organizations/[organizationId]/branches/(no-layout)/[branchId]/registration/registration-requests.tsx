"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Bell, Clock3, FileInput } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dispatchRegistrationPrefill } from "@/lib/prefill-events";
import {
  confirmRegistrationRequestAction,
  getPendingRegistrationRequestsAction,
} from "./registration.action";

export function RegistrationRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ organizationId: string; branchId: string }>();

  useEffect(() => {
    void (async () => {
      const [data, error] = await getPendingRegistrationRequestsAction();
      if (error) return toast.error(error.message);
      setRequests(data ?? []);
    })();
  }, []);

  async function continueRequest(request: any) {
    setLoadingId(request.id);
    if (request.status === "PENDING") {
      const [, error] = await confirmRegistrationRequestAction({
        requestId: request.id,
      });
      if (error) {
        setLoadingId("");
        return toast.error(error.message);
      }
      setRequests((current) =>
        current.map((item) =>
          item.id === request.id ? { ...item, status: "CONFIRMED" } : item,
        ),
      );
      setLoadingId("");
      toast.success("Demande examinée. Vous pouvez pré-remplir l'inscription.");
      return;
    }

    const target = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/registration?requestId=${request.id}`;
    const onRegistrationPage = pathname.includes("/registration");
    const currentId = searchParams.get("requestId");

    if (onRegistrationPage) {
      if (currentId === request.id) {
        dispatchRegistrationPrefill(request.id);
      } else {
        router.replace(target);
      }
    } else {
      router.push(target);
    }
    setLoadingId("");
  }

  if (!requests.length) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" />
          Demandes en attente
          <Badge>{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {requests.map((request) => {
          const student = request.studentData as Record<string, string>;
          const guardians = request.guardiansData as Array<
            Record<string, string>
          >;
          const isConfirmed = request.status === "CONFIRMED";
          return (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {student.name} {student.postnom} {student.prenom}
                </p>
                <p className="text-xs text-muted-foreground">
                  {request.reference} ·{" "}
                  {request.requestedLevel || "Niveau non precise"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Responsable : {guardians[0]?.name || "-"} ·{" "}
                  {new Date(request.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => continueRequest(request)}
                disabled={loadingId === request.id}
              >
                {isConfirmed ? (
                  <FileInput className="mr-2 size-4" />
                ) : (
                  <Clock3 className="mr-2 size-4" />
                )}
                {loadingId === request.id
                  ? "Ouverture..."
                  : isConfirmed
                    ? "Pré-remplir"
                    : "Examiner la demande"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
