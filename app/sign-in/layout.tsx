import { Toaster } from "sonner";

export default function SignInLayout({
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
