"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { IconUserPlus, IconUsers } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";

import Loading from "../loading";
import UserList from "./components/TeachersTable";
import { TeacherUpForm } from "./components/teacher-form";

export default function Teachers() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const { data: session, isPending } = useSession();
  const canManage = canManageOrganization(session);

  const handleUserAction = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (isPending) {
    return <Loading />;
  }

  if (!session) {
    redirect("/not-authorized");
  }

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Gestion des Enseignants"
          description="Gerer les informations des enseignants et leurs contrats dans l'etablissement"
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Enseignants
            </Badge>
          }
          actions={
            canManage ? (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    leftSection={<IconUserPlus size={16} />}
                  >
                    Ajouter un Enseignant
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Creer un Enseignant</DialogTitle>
                    <DialogDescription>
                      Remplir les informations de l'enseignant.
                    </DialogDescription>
                  </DialogHeader>
                  <TeacherUpForm
                    mode="create"
                    onTeacherCreated={() => {
                      handleUserAction();
                      setOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
            ) : null
          }
        />
        <Card
          variant="elevated"
          className="mt-0 border p-1 md:p-4 rounded-md shadow-sm"
        >
          <UserList
            key={refreshKey}
            refreshKey={refreshKey}
            onRefresh={handleUserAction}
            canManageTeachers={canManage}
          />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
