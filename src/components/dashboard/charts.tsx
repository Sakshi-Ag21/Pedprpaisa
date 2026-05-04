'use client'

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  Area, AreaChart,
} from 'recharts'
import { formatCompact } from '@/lib/utils'

const COLORS = ['#b88b82', '#8fa888', '#c4a882', '#9b8ea8', '#82a0b8', '#b8a282', '#8ab8b0', '#c49a8a']

interface CategoryData {
  name: string
  value: number
  color?: string
}

interface MonthlyData {
  month: string
  income: number
  expenses: number
  savings: number
}

const tooltipStyle = {
  background: 'var(--color-card, #fff)',
  border: '1px solid var(--color-border, #e5e0d8)',
  borderRadius: '12px',
  fontSize: '12px',
  fontFamily: 'inherit',
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
}

export function ExpensePieChart({ data }: { data: CategoryData[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={entry.color ?? COLORS[i % COLORS.length]} opacity={0.85} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
          contentStyle={tooltipStyle}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MonthlyBarChart({ data }: { data: MonthlyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barSize={7} barCategoryGap="35%">
        <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} opacity={0.6} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)', fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)', fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
          contentStyle={tooltipStyle}
        />
        <Legend wrapperStyle={{ fontSize: '10px', letterSpacing: '0.05em' }} />
        <Bar dataKey="income" name="Inflow" fill="#8fa888" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name="Outflow" fill="#b88b82" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SavingsTrendChart({ data }: { data: MonthlyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#b88b82" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#b88b82" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} opacity={0.6} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)', fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)', fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Harvest']}
          contentStyle={tooltipStyle}
        />
        <Area type="monotone" dataKey="savings" stroke="#b88b82" strokeWidth={1.5} fill="url(#savingsGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
