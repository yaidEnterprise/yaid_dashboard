import { Toaster } from "sonner";

export default function OnboardingLayout({
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
