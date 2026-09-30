"use client"

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { npr, nprShort } from "@/lib/format"

// Validated categorical palette (blue / orange / aqua) — fixed order, never cycled.
export const SERIES = {
  sales: "#2a78d6",
  purchase: "#eb6834",
  third: "#1baf7a",
  receivable: "#1baf7a",
  payable: "#eb6834",
}

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const
const grid = { stroke: "var(--border)", strokeDasharray: "3 3", vertical: false } as const

type TooltipPayload = { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }

function ChartTooltip({ active, payload, label, format = npr }: { active?: boolean; payload?: TooltipPayload[]; label?: string; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <div className="mb-1 font-medium text-foreground">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="num ml-auto pl-3 font-semibold text-foreground">{format(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  )
}

export function TrendChart({
  data,
  series,
  type = "bar",
  height = 260,
}: {
  data: Record<string, string | number>[]
  series: { key: string; name: string; color: string }[]
  type?: "bar" | "area" | "line"
  height?: number
}) {
  const common = { data, margin: { top: 8, right: 8, left: 0, bottom: 0 } }
  const x = <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
  const y = <YAxis {...axis} width={44} tickFormatter={(v) => nprShort(Number(v))} />
  const tip = <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
  const legend = series.length > 1 ? <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} /> : null
  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === "bar" ? (
        <BarChart {...common} barGap={2}>
          <CartesianGrid {...grid} />
          {x}
          {y}
          {tip}
          {legend}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      ) : type === "area" ? (
        <AreaChart {...common}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...grid} />
          {x}
          {y}
          <Tooltip content={<ChartTooltip />} />
          {legend}
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
          ))}
        </AreaChart>
      ) : (
        <LineChart {...common}>
          <CartesianGrid {...grid} />
          {x}
          {y}
          <Tooltip content={<ChartTooltip />} />
          {legend}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}

/** Horizontal bars — good for category comparisons with long labels. */
export function HBarChart({
  data,
  color = SERIES.sales,
  height,
  name = "Value",
  format = npr,
}: {
  data: { label: string; value: number; color?: string }[]
  color?: string
  height?: number
  name?: string
  format?: (v: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axis} tickFormatter={(v) => nprShort(Number(v))} />
        <YAxis type="category" dataKey="label" {...axis} width={130} tick={{ fontSize: 11, fill: "var(--foreground)" }} />
        <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
        <Bar dataKey="value" name={name} radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
