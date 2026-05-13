"use client";

import { Filter, Check, X } from "lucide-react";
import { cn } from "@/utils/utils";
import { useState, useRef, useEffect } from "react";

interface FilterPopoverProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  icon?: React.ReactNode;
}

export function FilterPopover<T extends string>({
  label,
  options,
  selected,
  onChange,
  icon,
}: FilterPopoverProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggle = (v: T) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  const active = selected.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border bg-surface px-3 text-sm font-medium transition-colors",
          active
            ? "border-trust/50 text-text-primary"
            : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary",
        )}
      >
        {icon ?? <Filter className="h-4 w-4" />}
        {label}
        {active && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-trust px-1.5 text-[10px] font-semibold text-primary-foreground">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-surface p-1 shadow-elevated">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {label}
            </span>
            {active && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-text-primary"
              >
                <X className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {options.map((opt) => {
              const isSel = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-text-primary transition-colors hover:bg-surface-muted"
                >
                  <span className="truncate">{opt.label}</span>
                  {isSel && <Check className="h-4 w-4 shrink-0 text-trust" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
