import Image from "next/image";

interface VerificationLayoutProps {
  children: React.ReactNode;
}

export function VerificationLayout({ children }: VerificationLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-[520px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Image src="/yaid_icon.svg" alt="YaID" width={20} height={20} className="h-5 w-5 object-contain" />
          </div>
          <span className="text-lg font-bold text-text-primary">YaID</span>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          {children}
        </div>
      </div>
    </div>
  );
}
