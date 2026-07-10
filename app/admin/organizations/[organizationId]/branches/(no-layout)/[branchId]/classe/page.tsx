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
import { canAccessTeachingArea } from "@/lib/auth/session-roles";

import Loading from "../loading";
import Classes from "./components/ClassesClient";
import { ClasseUpForm } from "./components/classe-form";

export default function Page() {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <Loading />;
  }

  if (!session || !canAccessTeachingArea(session)) {
    redirect("/not-authorized");
  }

  return (
    <Layout>
      <LayoutBody className="space-y-2">
        <PageHeader
          title="Gestion des classes"
          description="Gerer les informations des classes"
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Classes
            </Badge>
          }
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  leftSection={<IconUserPlus size={16} />}
                >
                  Creer une classe
                </Button>
              </DialogTrigger>

              <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Creer une classe</DialogTitle>
                  <DialogDescription>
                    Remplir les informations de la classe
                  </DialogDescription>
                </DialogHeader>

                <ClasseUpForm
                  mode="create"
                  onCreated={() => {
                    setRefreshKey((value) => value + 1);
                    setOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          }
        />

        <Card variant="elevated" padding="none">
          <Classes refreshKey={refreshKey} />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
