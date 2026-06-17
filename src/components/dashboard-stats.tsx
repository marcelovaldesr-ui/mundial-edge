import { Card, CardContent } from "@/components/ui/card";

export function DashboardStats({
  items,
}: {
  items: Array<{ label: string; value: string | number; helper?: string; tone?: "default" | "success" | "warning" }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p
              className={
                "mt-1 text-2xl font-bold tabular-nums " +
                (item.tone === "success" ? "text-success" : item.tone === "warning" ? "text-warning" : "")
              }
            >
              {item.value}
            </p>
            {item.helper && <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
