"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { fetchWithAuth } from "@/utils/fetch-with-auth";
import { cn } from "@/utils/utils";

interface CompanyData {
  id: string;
  name: string;
}

type LoadState = "loading" | "ready" | "error";

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} />
  );
}

export function AppTopbar() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    fetchWithAuth("/api/companies/me")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json() as Promise<CompanyData>;
      })
      .then((data) => {
        setCompany(data);
        setState("ready");
      })
      .catch(() => {
        setState("error");
      });
  }, []);

  const initial =
    state === "ready" && company?.name
      ? company.name.charAt(0).toUpperCase()
      : "?";

  const companyName = state === "ready" && company ? company.name : null;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/75 sm:px-6">
      {/* Spacer for mobile sidebar trigger */}
      <div className="w-8 lg:hidden" />

      {/* Company name — skeleton while loading */}
      <div className="hidden items-center gap-2 sm:flex">
        {state === "loading" ? (
          <Bone className="h-4 w-36" />
        ) : (
          <span className="text-sm font-medium text-text-primary">
            {companyName ?? ""}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Link
          href="/settings"
          className="ml-1 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-1.5 py-1 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {/* Avatar — skeleton while loading, neutral on error */}
          {state === "loading" ? (
            <Bone className="h-7 w-7 rounded-md" />
          ) : (
            <span
              aria-label={companyName ?? "Company"}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold",
                state === "error"
                  ? "bg-surface-muted text-text-tertiary"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {initial}
            </span>
          )}

          {/* Company name abbreviation — skeleton while loading */}
          {state === "loading" ? (
            <Bone className="hidden h-3.5 w-20 sm:block" />
          ) : (
            <span className="hidden pr-1 text-xs font-medium text-text-primary sm:inline">
              {companyName ?? ""}
            </span>
          )}

          <ChevronDown className="hidden h-3.5 w-3.5 text-text-tertiary sm:inline" />
        </Link>
      </div>
    </header>
  );
}
