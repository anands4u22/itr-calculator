"use client";

import { useEffect, useId, useState } from "react";

interface CurrencyInputProps {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  allowNegative?: boolean;
}

function formatDisplay(value: number): string {
  if (value === 0) return "";
  return value.toLocaleString("en-IN");
}

function sanitizeDraft(raw: string, allowNegative: boolean): string {
  let s = raw.replace(/[,₹\s]/g, "").replace(/[^\d-]/g, "");
  if (!allowNegative) return s.replace(/-/g, "");
  const negative = s.startsWith("-");
  s = s.replace(/-/g, "");
  return negative ? `-${s}` : s;
}

function parseDraft(raw: string, allowNegative: boolean): number | null {
  const cleaned = sanitizeDraft(raw, allowNegative);
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function CurrencyInput({
  label,
  hint,
  value,
  onChange,
  allowNegative = false,
}: CurrencyInputProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!focused) setDraft("");
  }, [value, focused]);

  const display = focused ? draft : formatDisplay(value);

  const commitDraft = (raw: string) => {
    const parsed = parseDraft(raw, allowNegative);
    if (parsed === null) {
      onChange(0);
      return;
    }
    if (!allowNegative && parsed < 0) {
      onChange(0);
      return;
    }
    onChange(Math.round(parsed));
  };

  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
          aria-hidden
        >
          ₹
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={display}
          placeholder="0"
          onFocus={() => {
            setFocused(true);
            setDraft(value === 0 ? "" : String(value));
          }}
          onBlur={() => {
            commitDraft(draft);
            setFocused(false);
          }}
          onChange={(e) => {
            const next = sanitizeDraft(e.target.value, allowNegative);
            setDraft(next);
            const parsed = parseDraft(next, allowNegative);
            if (parsed !== null) {
              if (!allowNegative && parsed < 0) return;
              onChange(Math.round(parsed));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
            }
          }}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 text-sm tabular-nums text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </label>
  );
}
