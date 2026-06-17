"use client";

import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip, LabelList } from "recharts";

interface Datum { label: string; modelo: number; implícita: number; }

export function ProbabilityChart({ data }: { data: Datum[] }) {
  const chart = data.map((d) => ({ ...d, modelo: +(d.modelo * 100).toFixed(1), implícita: +(d.implícita * 100).toFixed(1) }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="label" stroke="hsl(215 16% 60%)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(215 16% 60%)" fontSize={11} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "hsl(222 28% 10%)", border: "1px solid hsl(217 22% 18%)", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => `${v}%`}
          />
          <Bar dataKey="implícita" fill="hsl(215 16% 45%)" radius={[4, 4, 0, 0]} name="Prob. implícita" />
          <Bar dataKey="modelo" fill="hsl(199 89% 52%)" radius={[4, 4, 0, 0]} name="Prob. modelo">
            <LabelList dataKey="modelo" position="top" fontSize={10} fill="hsl(210 20% 96%)" formatter={(v: number) => `${v}%`} />
            {chart.map((_, i) => <Cell key={i} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
