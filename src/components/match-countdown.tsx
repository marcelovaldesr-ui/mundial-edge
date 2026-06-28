"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function calcCountdown(kickoff: string): string {
  const diff = new Date(kickoff).getTime() - Date.now();
  if (diff <= 0) return "";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 48) return `En ${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `En ${h}h ${m}m`;
  return `En ${m}m`;
}

export function MatchCountdown({ kickoff }: { kickoff: string }) {
  const [label, setLabel] = useState(() => calcCountdown(kickoff));

  useEffect(() => {
    const id = setInterval(() => setLabel(calcCountdown(kickoff)), 60_000);
    return () => clearInterval(id);
  }, [kickoff]);

  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-primary">
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}
