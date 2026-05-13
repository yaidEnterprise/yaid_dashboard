import { Toaster } from "sonner";

export default function SignUpLayout({
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
