"use client";

import { Layout, LayoutBody } from "@/components/custom/layout";
import UserList from "./components/ParentsTable";
import { Badge } from "@/components/ui/badge";
import { IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default function Parents() {
  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Gestion des Tuteurs"
          description="Gérer les informations des Tuteurs et leurs contrats dans l'établissement"
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Tuteurs
            </Badge>
          }
        />
        {/* Liste des parents */}
        <Card
          variant="elevated"
          className="mt-0 border p-1 md:p-4 rounded-md shadow-sm"
        >
          <UserList refreshKey={0} />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
