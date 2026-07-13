"use client";

import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { IconSchool, IconSchoolOff, IconUserPlus, IconUsers } from "@tabler/icons-react";

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
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/auth-client";
import { canAccessTeachingArea } from "@/lib/auth/session-roles";

import Loading from "../loading";
import Classes from "./components/ClassesClient";
import { ClasseUpForm } from "./components/classe-form";
import { getClassesAction } from "./classe.action";

export default function Page() {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const { data: session, isPending } = useSession();

  useEffect(() => { void (async () => {
    const [items] = await getClassesAction();
    if (!items) return;
    const active = items.filter(item => item.statusClasse !== false).length;
    setStats({ total: items.length, active, inactive: items.length - active });
  })(); }, [refreshKey]);

  if (isPending) {
    return <Loading />;
  }

  if (!session || !canAccessTeachingArea(session)) {
    redirect("/not-authorized");
  }

  return (
    <Layout>
      <LayoutBody className="space-y-5">
        <PageHeader
          title="Gestion des classes"
          description="Créez les classes et organisez leur capacité, option et créneau."
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Classes
            </Badge>
          }
          actions={
            <Button type="button" variant="default" onClick={() => setOpen(true)}>
              <IconUserPlus size={16} className="mr-2" />
              Créer une classe
            </Button>
          }
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Creer une classe</DialogTitle>
              <DialogDescription>
                Remplir les informations de la classe
              </DialogDescription>
            </DialogHeader>

            {open ? (
              <ClasseUpForm
                key="create-classe"
                mode="create"
                onCreated={() => {
                  setRefreshKey((value) => value + 1);
                  setOpen(false);
                }}
              />
            ) : null}
          </DialogContent>
        </Dialog>

        <div className="grid gap-3 sm:grid-cols-3">
          <ClassStat label="Total des classes" value={stats.total} icon={<IconUsers className="size-5" />} />
          <ClassStat label="Classes actives" value={stats.active} icon={<IconSchool className="size-5 text-emerald-600" />} />
          <ClassStat label="Classes inactives" value={stats.inactive} icon={<IconSchoolOff className="size-5 text-slate-500" />} />
        </div>

        <Card variant="elevated" padding="none">
          <Classes refreshKey={refreshKey} />
        </Card>
      </LayoutBody>
    </Layout>
  );
}

function ClassStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><div className="rounded-lg bg-muted p-2">{icon}</div></Card>;
}
