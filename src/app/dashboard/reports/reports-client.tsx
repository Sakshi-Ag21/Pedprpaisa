'use client'

import { useMemo, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { MonthlyBarChart, ExpensePieChart } from '@/components/dashboard/charts'
import { Download, FileText } from 'lucide-react'
import { formatCurrency, formatCompact, getMonthName, calculateSavingsRate } from '@/lib/utils'
import type { Transaction } from '@/types/database'
import Papa from 'papaparse'

type TxWithCat = Transaction & { categories: { name: string; icon: string; color: string } | null }

interface Props { transactions: TxWithCat[] }

export function ReportsClient({ transactions }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const monthlyData = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>()
    transactions.forEach(t => {
      const d = new Date(t.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const existing = map.get(key) ?? { income: 0, expenses: 0 }
      if (t.type === 'income') existing.income += t.amount
      else if (t.type === 'expense') existing.expenses += t.amount
      map.set(key, existing)
    })
    return Array.from(map.entries()).map(([key, data]) => {
      const [, monthIdx] = key.split('-').map(Number)
      return { month: getMonthName(monthIdx), income: data.income, expenses: data.expenses, savings: data.income - data.expenses }
    })
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(selectedMonth))
  }, [transactions, selectedMonth])

  const monthIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const savingsRate = calculateSavingsRate(monthIncome, monthExpenses)

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { value: number; color: string }>()
    filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
      const name = t.categories?.name ?? 'Other'
      const color = t.categories?.color ?? '#64748b'
      const existing = map.get(name)
      map.set(name, { value: (existing?.value ?? 0) + t.amount, color })
    })
    return Array.from(map.entries()).map(([name, { value, color }]) => ({ name, value, color })).sort((a, b) => b.value - a.value)
  }, [filteredTransactions])

  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map(t => t.date.slice(0, 7)))
    return Array.from(months).sort().reverse()
  }, [transactions])

  function exportCSV() {
    const data = filteredTransactions.map(t => ({
      Date: t.date, Title: t.title, Type: t.type, Amount: t.amount,
      Category: t.categories?.name ?? 'Uncategorized', Method: t.payment_method,
      Notes: t.notes ?? '', 'Emotional Tag': t.emotional_tag ?? '',
    }))
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedprpaisa-${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col">
      <Topbar title="Reports" description="Financial insights and exports" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>
                {new Date(m + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Monthly Summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Income', value: monthIncome, color: 'text-emerald-500' },
            { label: 'Expenses', value: monthExpenses, color: 'text-red-400' },
            { label: 'Savings', value: monthIncome - monthExpenses, color: 'text-indigo-400' },
            { label: 'Savings Rate', value: savingsRate, color: savingsRate >= 20 ? 'text-emerald-500' : 'text-amber-500', suffix: '%' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>
                {'suffix' in s ? `${s.value}%` : formatCurrency(s.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">12-Month Overview</h3>
            <MonthlyBarChart data={monthlyData} />
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Category Breakdown</h3>
            {categoryBreakdown.length > 0 ? (
              <>
                <ExpensePieChart data={categoryBreakdown} />
                <div className="mt-3 space-y-1.5">
                  {categoryBreakdown.map(c => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                        <span className="text-muted-foreground">{c.name}</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-muted-foreground">{monthExpenses > 0 ? Math.round((c.value / monthExpenses) * 100) : 0}%</span>
                        <span className="font-medium">{formatCompact(c.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No expense data</div>
            )}
          </div>
        </div>

        {/* Transaction table */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold">Transactions ({filteredTransactions.length})</h3>
            <Button variant="ghost" size="sm" className="gap-2" onClick={exportCSV}>
              <FileText className="h-4 w-4" /> Export
            </Button>
          </div>
          {filteredTransactions.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">No transactions for this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-accent/50">
                  <tr>
                    {['Date', 'Description', 'Category', 'Method', 'Amount'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-accent/30">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{t.date}</td>
                      <td className="px-4 py-2.5 font-medium max-w-[180px] truncate">{t.title}</td>
                      <td className="px-4 py-2.5 text-xs">{t.categories?.icon} {t.categories?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{t.payment_method?.replace('_', ' ')}</td>
                      <td className={`px-4 py-2.5 font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-500' : 'text-red-400'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
