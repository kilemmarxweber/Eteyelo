import { Layout, LayoutBody } from "@/components/custom/layout";

export default function FicheCentralesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Layout>
      <LayoutBody className="space-y-6">{children}</LayoutBody>
    </Layout>
  );
}
