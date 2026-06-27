import { cn } from "@/lib/utils";

export function DashboardStats({
  items,
}: {
  items: Array<{ label: string; value: string | number; helper?: string; tone?: "default" | "success" | "warning" }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
      {items.map((item, i) => (
        <div key={item.label} className={cn(
          "bg-card px-4 py-5",
          i === 0 && "rounded-tl-[calc(var(--radius)+1px)] rounded-bl-[calc(var(--radius)+1px)]",
          i === items.length - 1 && "rounded-tr-[calc(var(--radius)+1px)] rounded-br-[calc(var(--radius)+1px)]"
        )}>
          <p className="section-label">{item.label}</p>
          <p className={cn(
            "mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight",
            item.tone === "success" && "text-success-foreground",
            item.tone === "warning" && "text-warning"
          )}>
            {item.value}
          </p>
          {item.helper && (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.helper}</p>
          )}
        </div>
      ))}
    </div>
  );
}
