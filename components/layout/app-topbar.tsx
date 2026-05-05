"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { EnvBadge } from "@/components/feedback/environment-badge";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/75 sm:px-6">
      {/* Spacer for mobile sidebar trigger */}
      <div className="w-8 lg:hidden" />

      <div className="hidden items-center gap-2 sm:flex">
        <span className="text-sm font-medium text-text-primary">Acme Identidade Ltda.</span>
        <span className="text-text-tertiary">·</span>
        <EnvBadge env="homol" />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Link
          href="/settings"
          className="ml-1 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-1.5 py-1 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            MR
          </span>
          <span className="hidden pr-1 text-xs font-medium text-text-primary sm:inline">
            Maria R.
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-text-tertiary sm:inline" />
        </Link>
      </div>
    </header>
  );
}
