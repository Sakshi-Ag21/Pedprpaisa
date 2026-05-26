'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { Pencil, TrendingDown, TrendingUp, Target, CalendarDays, Wallet } from 'lucide-react'
import { formatCurrency, isWeekend, getProgressPercentage } from '@/lib/utils'
import Link from 'next/link'

interface Tx { amount: number; type: string; date: string }
interface GoalRow { name: string; icon: string; color: string; current_amount: number; target_amount: number; auto_save_amount: number }

interface Props {
  weekendBudget: number
  monthlySalary: number
  transactions: Tx[]
  goals: GoalRow[]
  userId: string
}

export function BudgetClient({ weekendBudget: initialWb, monthlySalary, transactions, goals, userId }: Props) {
  const [weekendBudget, setWeekendBudget] = useState(initialWb)
  const [editOpen, setEditOpen] = useState(false)
  const [editValue, setEditValue] = useState(String(initialWb || ''))
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // ── Compute this month's numbers ──────────────────────────────────────
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const weekendExpenses = transactions.filter(t => t.type === 'expense' && isWeekend(t.date)).reduce((s, t) => s + t.amount, 0)
  const weekdayExpenses = totalExpenses - weekendExpenses

  const goalsSavedTotal = goals.reduce((s, g) => s + g.current_amount, 0)
  const goalsAutoSaveMonthly = goals.filter(g => g.auto_save_amount > 0).reduce((s, g) => s + g.auto_save_amount, 0)

  const effectiveIncome = income > 0 ? income : monthlySalary
  const freeToSpend = effectiveIncome - totalExpenses

  const weekendPct = weekendBudget > 0 ? Math.min(Math.round((weekendExpenses / weekendBudget) * 100), 100) : 0
  const weekendOver = weekendBudget > 0 && weekendExpenses > weekendBudget
  const weekdayPct = weekendBudget > 0 && effectiveIncome > 0
    ? Math.min(Math.round((weekdayExpenses / effectiveIncome) * 100), 100)
    : 0

  // ── Save weekend budget ───────────────────────────────────────────────
  async function handleSaveWb() {
    setSaving(true)
    const val = parseFloat(editValue) || 0
    const { error } = await supabase.from('profiles').update({ weekend_budget: val }).eq('id', userId)
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' })
    } else {
      setWeekendBudget(val)
      toast({ title: 'Weekend Pocket updated!' })
      setEditOpen(false)
      router.refresh()
    }
    setSaving(false)
  }

  // ── Pocket bar helper ─────────────────────────────────────────────────
  function PocketBar({ label, icon, spent, budget, color, emoji }: {
    label: string; icon: React.ReactNode; spent: number; budget: number; color: string; emoji: string
  }) {
    const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0
    const over = budget > 0 && spent > budget
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="text-base">{emoji}</span> {label}
          </span>
          <span className={`text-sm font-semibold ${over ? 'text-red-400' : ''}`}>
            {formatCurrency(spent)} {budget > 0 && <span className="text-muted-foreground font-normal">/ {formatCurrency(budget)}</span>}
          </span>
        </div>
        {budget > 0 && (
          <>
            <Progress value={pct} className="h-2" style={{ '--progress-color': over ? '#f87171' : color } as React.CSSProperties} />
            <p className="text-xs text-muted-foreground">{over ? `⚠️ ₹${Math.round(spent - budget).toLocaleString('en-IN')} over budget` : `${formatCurrency(budget - spent)} remaining`}</p>
          </>
        )}
        {budget === 0 && (
          <div className="h-2 rounded-full bg-accent" />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Topbar title="Budget" description="Where your money actually goes" />

      <div className="p-4 md:p-6 space-y-5 max-w-2xl">

        {/* Money Flow overview */}
        <div className="flora-card p-5 space-y-4">
          <p className="label-spaced">This Month&apos;s Money Flow</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-500/8 p-3 text-center">
              <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground mb-0.5">In</p>
              <p className="text-base font-semibold text-emerald-500">{formatCurrency(income > 0 ? income : monthlySalary)}</p>
              {income === 0 && <p className="text-[10px] text-muted-foreground">salary estimate</p>}
            </div>
            <div className="rounded-xl bg-primary/8 p-3 text-center">
              <TrendingDown className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground mb-0.5">Spent</p>
              <p className="text-base font-semibold">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${freeToSpend >= 0 ? 'bg-sage/30' : 'bg-red-500/8'}`}>
              <Wallet className={`h-4 w-4 mx-auto mb-1 ${freeToSpend >= 0 ? 'text-emerald-600' : 'text-red-400'}`} />
              <p className="text-xs text-muted-foreground mb-0.5">Left</p>
              <p className={`text-base font-semibold ${freeToSpend >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{formatCurrency(freeToSpend)}</p>
            </div>
          </div>

          {/* Stacked bar */}
          {effectiveIncome > 0 && (
            <div className="space-y-1.5">
              <div className="flex h-3 rounded-full overflow-hidden gap-px">
                <div className="bg-primary/70 transition-all" style={{ width: `${Math.min((weekdayExpenses / effectiveIncome) * 100, 100)}%` }} title="Weekday spend" />
                <div className={`transition-all ${weekendOver ? 'bg-red-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min((weekendExpenses / effectiveIncome) * 100, 100 - (weekdayExpenses / effectiveIncome) * 100)}%` }}
                  title="Weekend spend" />
                <div className="bg-emerald-500/40 flex-1" title="Free to spend" />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/70 inline-block" /> Weekday</span>
                <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-sm inline-block ${weekendOver ? 'bg-red-400' : 'bg-amber-400'}`} /> Weekend</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/40 inline-block" /> Free</span>
              </div>
            </div>
          )}
        </div>

        {/* Weekend Pocket */}
        <div className={`flora-card p-5 space-y-4 ${weekendOver ? 'border-red-400/30' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-amber-500" />
              <p className="label-spaced">Weekend Pocket</p>
            </div>
            <button
              onClick={() => { setEditValue(String(weekendBudget || '')); setEditOpen(true) }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Pencil className="h-3 w-3" />
              {weekendBudget > 0 ? 'Edit budget' : 'Set budget'}
            </button>
          </div>

          {weekendBudget === 0 ? (
            <div className="rounded-xl bg-amber-500/8 border border-amber-400/20 px-4 py-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No weekend budget set yet.</p>
              <p className="text-xs text-muted-foreground">Set a monthly limit for your Saturday &amp; Sunday spending and we&apos;ll track it automatically.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 border-amber-400/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={() => { setEditValue(''); setEditOpen(true) }}
              >
                🎉 Set Weekend Budget
              </Button>
            </div>
          ) : (
            <PocketBar
              label="Weekend spending this month"
              emoji="🎉"
              icon={<CalendarDays className="h-4 w-4" />}
              spent={weekendExpenses}
              budget={weekendBudget}
              color="#f59e0b"
            />
          )}

          {weekendBudget > 0 && (
            <div className="rounded-lg bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
              All Saturday &amp; Sunday expenses are counted here automatically. To add one, go to{' '}
              <Link href="/dashboard/transactions" className="text-primary hover:underline">Transactions</Link> and log an expense on a weekend date.
            </div>
          )}
        </div>

        {/* Goals pocket */}
        {goals.length > 0 && (
          <div className="flora-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-400" />
                <p className="label-spaced">Goals Pocket</p>
              </div>
              <Link href="/dashboard/goals" className="text-xs text-primary hover:underline">Manage →</Link>
            </div>

            <div className="space-y-4">
              {goals.map((g, i) => {
                const pct = getProgressPercentage(g.current_amount, g.target_amount)
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span>{g.icon}</span>
                        <span className="font-medium">{g.name}</span>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" style={{ '--progress-color': g.color } as React.CSSProperties} />
                    <p className="text-xs text-muted-foreground">{pct}% complete{g.auto_save_amount > 0 ? ` · ${formatCurrency(g.auto_save_amount)}/mo auto-save` : ''}</p>
                  </div>
                )
              })}
            </div>

            {goalsSavedTotal > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-indigo-500/8 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">Total saved across goals</span>
                <span className="font-semibold text-indigo-400">{formatCurrency(goalsSavedTotal)}</span>
              </div>
            )}
            {goalsAutoSaveMonthly > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(goalsAutoSaveMonthly)}/month reserved for auto-save across {goals.filter(g => g.auto_save_amount > 0).length} goal{goals.filter(g => g.auto_save_amount > 0).length !== 1 ? 's' : ''}.
              </p>
            )}
          </div>
        )}

        {goals.length === 0 && (
          <div className="flora-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-400" />
              <p className="label-spaced">Goals Pocket</p>
            </div>
            <p className="text-sm text-muted-foreground">No active goals yet. When you add funds to a goal, it deducts from your available balance.</p>
            <Link href="/dashboard/goals">
              <Button variant="outline" size="sm">🎯 Create a Goal</Button>
            </Link>
          </div>
        )}

      </div>

      {/* Edit Weekend Budget dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🎉 Weekend Pocket Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set how much you allow yourself to spend on Saturdays &amp; Sundays each month. All weekend expenses will be tracked against this.
            </p>
            <div className="space-y-1.5">
              <Label>Monthly weekend budget (₹)</Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 5000"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                autoFocus
              />
            </div>
            {editValue && parseFloat(editValue) > 0 && (
              <p className="text-xs text-muted-foreground">
                That&apos;s about {formatCurrency(parseFloat(editValue) / 4)} per weekend.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSaveWb} disabled={saving}>
              {saving ? 'Saving…' : 'Save Budget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
