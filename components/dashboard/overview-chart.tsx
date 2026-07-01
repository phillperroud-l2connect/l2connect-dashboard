"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type ChartDataPoint = {
  name: string;
  receita: number;
  gastos: number;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="min-w-[160px] rounded-xl border px-3 py-2 text-sm shadow-xl"
      style={{
        background: "#060e1f",
        borderColor: "rgba(255,255,255,0.12)",
        color: "#e2e8f0",
      }}
    >
      <p className="mb-2 font-semibold">{label}</p>
      {payload.map((entry: { name: string; value: number; fill: string }) => (
        <p
          key={entry.name}
          className="flex justify-between gap-4"
          style={{ color: entry.fill }}
        >
          <span>{entry.name === "receita" ? "Receita" : "Gastos"}</span>
          <span className="font-bold">{fmtBRL(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function OverviewChart({ data }: { data: ChartDataPoint[] }) {
  const gap = data.length === 1 ? "55%" : data.length <= 3 ? "40%" : "28%";

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        barGap={6}
        barCategoryGap={gap}
        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fill: "#8899bb", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#8899bb", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
          width={36}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar
          dataKey="receita"
          fill="#00b4ff"
          radius={[4, 4, 0, 0]}
          maxBarSize={52}
        />
        <Bar
          dataKey="gastos"
          fill="#ff4d4d"
          radius={[4, 4, 0, 0]}
          maxBarSize={52}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
