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
import { StudentUpForm } from "./components/student-form";
import UserList from "./components/StudentsTable";

export default function Students() {
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
      <LayoutBody className="space-y-2">
        <PageHeader
          title="Gestion des eleves"
          description="Gerer les informations des eleves"
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Eleves
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
                    Ajouter un eleve
                  </Button>
                </DialogTrigger>

                <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Creer un eleve</DialogTitle>
                    <DialogDescription>
                      Remplir les informations de l'eleve
                    </DialogDescription>
                  </DialogHeader>

                  <StudentUpForm
                    mode="create"
                    onStudentCreate={() => {
                      handleUserAction();
                      setOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        <Card variant="elevated" padding="none">
          <UserList
            key={refreshKey}
            refreshKey={refreshKey}
            onRefresh={handleUserAction}
            canManageStudents={canManage}
          />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
