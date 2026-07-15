"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { NotFoundView } from "@/components/not-found-view";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/custom/button";

import { IconCalendar, IconPlus } from "@tabler/icons-react";

import EventsList from "./component/EventsList";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { canManageOrganization } from "@/lib/auth/session-roles";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { EventForm } from "./component/event.form";

export default function EventsPage() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const { refresh } = useRefresh();

  // ✅ Toujours avant les return conditionnels
  // ✅ loading
  if (isPending) {
    return null;
  }

  // ✅ auth
  if (!session) {
    return <NotFoundView />;
  }

  const handleSuccess = () => {
    refresh();
    setOpen(false);
  };

  const canCreateEvent = canManageOrganization(session);

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Gestion des événements"
          description="Créer et gérer les événements scolaires"
          badge={
            <Badge variant="outline-primary" icon={<IconCalendar size={14} />}>
              Events
            </Badge>
          }
          actions={
            <>
              {canCreateEvent && (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button leftSection={<IconPlus size={16} />}>
                      Ajouter un événement
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Créer un événement</DialogTitle>
                    </DialogHeader>

                    <EventForm
                      mode="create"
                      userId={session.user.id}
                      onSuccess={handleSuccess}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </>
          }
        />

        <Card variant="elevated" padding="none">
          <EventsList />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
