"use client";

import { useEffect, useState } from "react";
import { IconBook, IconBookOff, IconBooks, IconPlus } from "@tabler/icons-react";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { getCoursAction } from "../cours.action";
import { CoursUpForm } from "./cours-form";
import CoursList from "./coursTable";

export default function Cours() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const { refreshKey, refresh } = useRefresh();
  const { data: session } = useSession();
  const canCreate = canManageOrganization(session);

  useEffect(() => {
    void (async () => {
      const [items] = await getCoursAction({ includeInactive: true });
      if (!items) return;
      const active = items.filter(item => item.statusCours !== false).length;
      setStats({ total: items.length, active, inactive: items.length - active });
    })();
  }, [refreshKey]);

  function handleSaved() {
    refresh();
    setOpen(false);
  }

  return <Layout><LayoutBody className="space-y-5">
    <PageHeader title="Gestion des cours" description="Créez et organisez les matières enseignées dans cet établissement." badge={<Badge variant="outline-primary" icon={<IconBooks size={14} />}>Cours</Badge>} actions={canCreate ? <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button leftSection={<IconPlus size={16} />}>Ajouter un cours</Button></DialogTrigger><DialogContent size="lg"><DialogHeader><DialogTitle>Créer un cours</DialogTitle><DialogDescription>Renseignez le nom et la description. Le code unique sera généré automatiquement.</DialogDescription></DialogHeader><CoursUpForm mode="create" onCreated={handleSaved} /></DialogContent></Dialog> : null} />
    <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Total des cours" value={stats.total} icon={<IconBooks className="size-5" />} /><StatCard label="Cours actifs" value={stats.active} icon={<IconBook className="size-5 text-emerald-600" />} /><StatCard label="Cours inactifs" value={stats.inactive} icon={<IconBookOff className="size-5 text-slate-500" />} /></div>
    <Card variant="elevated" className="overflow-hidden rounded-md border p-1 shadow-sm md:p-3"><CoursList refreshKey={refreshKey} /></Card>
  </LayoutBody></Layout>;
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><div className="rounded-lg bg-muted p-2">{icon}</div></Card>;
}
