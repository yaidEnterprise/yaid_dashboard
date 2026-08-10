import { ExternalLink } from "lucide-react";

interface DeepLinkButtonProps {
  sessionToken: string;
  onOpen?: () => void;
}

export function DeepLinkButton({ sessionToken, onOpen }: DeepLinkButtonProps) {
  return (
    <a
      href={`yaid://verify?session=${encodeURIComponent(sessionToken)}`}
      onClick={onOpen}
      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
    >
      Abrir YaID Wallet
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}
