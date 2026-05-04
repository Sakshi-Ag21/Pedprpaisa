'use client'

import { useMemo } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { StatCard } from '@/components/dashboard/stat-card'
import { ExpensePieChart, MonthlyBarChart, SavingsTrendChart } from '@/components/dashboard/charts'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp, TrendingDown, PiggyBank, Target,
  RefreshCw, Calendar, Shield, Flower2,
} from 'lucide-react'
import {
  formatCurrency, formatCompact, formatDate, getDaysUntil,
  getProgressPercentage, calculateSavingsRate, getFinancialHealthScore,
  getMonthName,
} from '@/lib/utils'
import type { Transaction, Goal, Subscription, Profile, Investment, Category } from '@/types/database'
import Link from 'next/link'

type TxCat = { name: string; icon: string; color: string } | null

interface Props {
  transactions: (Omit<Transaction, 'categories'> & { categories: TxCat })[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allTransactions: any[]
  goals: Goal[]
  subscriptions: Subscription[]
  profile: Profile | null
  investments: Investment[]
  categories?: Category[]
  userId?: string
}

export function DashboardClient({ transactions, allTransactions, goals, subscriptions, profile, investments }: Props) {

  const { income, expenses, savings, savingsRate } = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const savings = income - expenses
    const savingsRate = calculateSavingsRate(income, expenses)
    return { income, expenses, savings, savingsRate }
  }, [transactions])

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { value: number; color: string }>()
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const name = t.categories?.name ?? 'Other'
      const color = t.categories?.color ?? '#b88b82'
      const existing = map.get(name)
      map.set(name, { value: (existing?.value ?? 0) + t.amount, color })
    })
    return Array.from(map.entries())
      .map(([name, { value, color }]) => ({ name, value, color }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [transactions])

  const monthlyData = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>()
    allTransactions.forEach(t => {
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
  }, [allTransactions])

  const totalInvestments = investments.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0)
  const totalSubscriptionCost = subscriptions.reduce((s, sub) => s + sub.amount, 0)
  const upcomingBills = subscriptions
    .filter(s => getDaysUntil(s.next_billing_date) <= 7 && getDaysUntil(s.next_billing_date) >= 0)
    .sort((a, b) => getDaysUntil(a.next_billing_date) - getDaysUntil(b.next_billing_date))
  const healthScore = getFinancialHealthScore(savingsRate, 70, 60)
  const now = new Date()
  const salary_day = profile?.salary_date ?? 1
  const daysUntilSalary = useMemo(() => {
    const today = now.getDate()
    if (salary_day > today) return salary_day - today
    const next = new Date(now.getFullYear(), now.getMonth() + 1, salary_day)
    return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }, [salary_day, now])

  const monthLabel = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Sanctuary" description={`${monthLabel} · your financial garden`} />

      <div className="p-5 md:p-7 space-y-6 flex-1">

        {/* Hero intention banner */}
        <div className="petal-card px-6 py-5 text-center space-y-2">
          <p className="label-spaced">Today&apos;s intention</p>
          <p className="font-serif text-xl md:text-2xl font-light italic text-foreground">
            &ldquo;She is building a soft, luxurious, financially secure life — one bloom at a time.&rdquo;
          </p>
          <div className="flora-rule" />
        </div>

        {/* Main stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Monthly Inflow"
            value={formatCompact(income)}
            subtitle={formatCurrency(income)}
            icon={TrendingUp}
            variant="sage"
          />
          <StatCard
            title="Mindful Outflow"
            value={formatCompact(expenses)}
            subtitle={`${savingsRate}% of inflow`}
            icon={TrendingDown}
            variant="petal"
          />
          <StatCard
            title="Liquid Harvest"
            value={formatCompact(savings)}
            subtitle="net this season"
            icon={PiggyBank}
          />
          <StatCard
            title="Portfolio"
            value={formatCompact(totalInvestments)}
            subtitle={`${investments.length} positions`}
            icon={TrendingUp}
          />
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Rituals Cost" value={formatCompact(totalSubscriptionCost)} subtitle="per month" icon={RefreshCw} />
          <StatCard title="Salary In" value={`${daysUntilSalary}d`} subtitle="days until salary" icon={Calendar} />
          <StatCard title="Health Score" value={`${healthScore}`} subtitle={healthScore >= 70 ? 'Flourishing' : healthScore >= 50 ? 'Growing' : 'Nurture needed'} icon={Shield} />
          <StatCard title="Transactions" value={String(transactions.length)} subtitle="this month" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flora-card p-5">
            <p className="label-spaced mb-4">Spending by Category</p>
            {categoryBreakdown.length > 0 ? (
              <>
                <ExpensePieChart data={categoryBreakdown} />
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                  {categoryBreakdown.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="text-muted-foreground truncate max-w-[120px]">{c.name}</span>
                      </div>
                      <span className="font-medium">{formatCompact(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground font-light italic">
                No expenses this season
              </div>
            )}
          </div>

          <div className="flora-card p-5 lg:col-span-2">
            <p className="label-spaced mb-4">Income vs Expenses · 6 months</p>
            {monthlyData.length > 0 ? (
              <MonthlyBarChart data={monthlyData} />
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground font-light italic">No data yet</div>
            )}
          </div>
        </div>

        {/* Savings + Goals + Bills */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flora-card p-5">
            <p className="label-spaced mb-4">Savings Trend</p>
            {monthlyData.length > 0 ? (
              <SavingsTrendChart data={monthlyData} />
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground font-light italic">No data</div>
            )}
          </div>

          {/* Visions / Goals */}
          <div className="flora-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="label-spaced">Visions in Bloom</p>
              <Link href="/dashboard/goals" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {goals.length > 0 ? (
              <div className="space-y-4">
                {goals.slice(0, 3).map(goal => {
                  const pct = getProgressPercentage(goal.current_amount, goal.target_amount)
                  return (
                    <div key={goal.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span>{goal.icon}</span>
                          <span className="font-medium truncate max-w-[130px]">{goal.name}</span>
                        </span>
                        <span className="text-muted-foreground">{pct}% bloomed</span>
                      </div>
                      <Progress value={pct} className="h-1" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCompact(goal.current_amount)}</span>
                        <span>{formatCompact(goal.target_amount)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center gap-2">
                <Target className="h-8 w-8 text-muted-foreground/30" strokeWidth={1} />
                <p className="text-xs text-muted-foreground font-light italic">Plant your first vision</p>
                <Link href="/dashboard/goals" className="text-xs text-primary hover:underline">Create one →</Link>
              </div>
            )}
          </div>

          {/* Upcoming Bills */}
          <div className="flora-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="label-spaced">Upcoming Rituals</p>
              <Link href="/dashboard/subscriptions" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {upcomingBills.length > 0 ? (
              <div className="space-y-2">
                {upcomingBills.map(bill => {
                  const days = getDaysUntil(bill.next_billing_date)
                  return (
                    <div key={bill.id} className="flex items-center justify-between rounded-lg bg-accent/60 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{bill.icon}</span>
                        <div>
                          <p className="text-xs font-medium">{bill.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {days === 0 ? 'Today' : `In ${days} day${days > 1 ? 's' : ''}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold">{formatCompact(bill.amount)}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center gap-2">
                <RefreshCw className="h-8 w-8 text-muted-foreground/30" strokeWidth={1} />
                <p className="text-xs text-muted-foreground font-light italic">No bills in the next 7 days</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Journal Entries */}
        <div className="flora-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="label-spaced">Recent Journal</p>
            <Link href="/dashboard/transactions" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {transactions.length > 0 ? (
            <div className="space-y-0">
              {transactions.slice(0, 8).map((t, i) => (
                <div key={t.id} className={`flex items-center justify-between py-3 ${i < Math.min(7, transactions.length - 1) ? 'border-b border-border/60' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm">
                      {t.categories?.icon ?? '✦'}
                    </div>
                    <div>
                      <p className="text-sm">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.categories?.name ?? 'Uncategorized'} · {formatDate(t.date)}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-medium ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                    {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center">
              <p className="text-sm text-muted-foreground font-light italic">No entries this season. Log your first moment.</p>
            </div>
          )}
        </div>
      </div>

      {/* LOG A MOMENT — FAB */}
      <Link
        href="/dashboard/transactions?new=1"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-primary text-primary-foreground px-5 py-3.5 shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.97] transition-all animate-bloom-pulse"
      >
        <Flower2 className="h-4 w-4" strokeWidth={1.5} />
        <span className="text-sm font-medium tracking-wide">Log a Moment</span>
      </Link>

    </div>
  )
}
