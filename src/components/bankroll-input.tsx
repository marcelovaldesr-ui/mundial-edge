"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "mundial_edge_bankroll";

export function BankrollInput({ onChange }: { onChange: (value: number) => void }) {
  const [raw, setRaw] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setRaw(stored);
      onChange(Number(stored));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handle(val: string) {
    setRaw(val);
    const n = parseFloat(val);
    const num = isNaN(n) || n < 0 ? 0 : n;
    if (num > 0) localStorage.setItem(STORAGE_KEY, String(num));
    else localStorage.removeItem(STORAGE_KEY);
    onChange(num);
  }

  const hasValue = raw !== "" && Number(raw) > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div className="relative max-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <input
            type="number"
            min="0"
            step="100"
            value={raw}
            onChange={(e) => handle(e.target.value)}
            placeholder="Mi bankroll"
            className="w-full rounded-md border border-border bg-background pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {hasValue ? "Stake recomendado en $" : "Stake recomendado en %"}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground max-w-sm leading-relaxed">
        Kelly Criterion es una referencia matemática. Las apuestas conllevan riesgo de pérdida real. Nunca apuestes más de lo que puedes perder.
      </p>
    </div>
  );
}
