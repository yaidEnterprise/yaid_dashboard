import type { Metadata } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Documentação de integração — YaID",
  description:
    "Guia público de integração YaID: crie sua conta e seu primeiro app, entenda os ambientes de homologação e produção e conecte sua aplicação.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Toaster richColors position="bottom-right" />
    </>
  );
}
