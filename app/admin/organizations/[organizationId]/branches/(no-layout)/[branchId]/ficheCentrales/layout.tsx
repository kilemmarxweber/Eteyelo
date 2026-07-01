import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { IconChartBar } from "@tabler/icons-react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Gestion des Fiches centrales"
          description="Gérer les informations des Fiches des élèves"
          badge={
            <Badge variant="outline-primary" icon={<IconChartBar size={14} />}>
              Fiches
            </Badge>
          }
        />
        <Card
          variant="default"
          className="mt-0 border flex flex-col xl:flex-row gap-2 rounded-md shadow-sm"
        >
          {children}
        </Card>
      </LayoutBody>
    </Layout>
  );
}
