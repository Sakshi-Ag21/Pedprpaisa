'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { Pencil, TrendingDown, TrendingUp, Target, CalendarDays, Wallet, Plus, Trash2 } from 'lucide-react'
import { formatCurrency, isWeekend, getProgressPercentage } from '@/lib/utils'
import Link from 'next/link'
import type { Budget, Category } from '@/types/database'

interface Tx {
  amount: number
  type: string
  date: string
  category_id: string | null
  categories: { id: string; name: string; icon: string; color: string } | null
}
interface GoalRow { name: string; icon: string; color: string; current_amount: number; target_amount: number; auto_save_amount: number }

interface Props {
  weekendBudget: number
  monthlySalary: number
  transactions: Tx[]
  goals: GoalRow[]
  categories: Category[]
  budgets: Budget[]
  userId: string
}

const EMPTY_BUDGET_FORM = { category_id: '', amount: '' }

export function BudgetClient({ weekendBudget: initialWb, monthlySalary, transactions, goals, categories, budgets: initialBudgets, userId }: Props) {
  const [weekendBudget, setWeekendBudget] = useState(initialWb)
  const [budgets, setBudgets] = useState(initialBudgets)
  const [wbEditOpen, setWbEditOpen] = useState(false)
  const [wbEditValue, setWbEditValue] = useState(String(initialWb || ''))
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [budgetForm, setBudgetForm] = useState(EMPTY_BUDGET_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // ── Monthly totals ────────────────────────────────────────────────────
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const weekendExpenses = transactions.filter(t => t.type === 'expense' && isWeekend(t.date)).reduce((s, t) => s + t.amount, 0)
  const weekdayExpenses = totalExpenses - weekendExpenses
  const goalsSavedTotal = goals.reduce((s, g) => s + g.current_amount, 0)
  const goalsAutoSaveMonthly = goals.filter(g => g.auto_save_amount > 0).reduce((s, g) => s + g.auto_save_amount, 0)
  const effectiveIncome = income > 0 ? income : monthlySalary
  const freeToSpend = effectiveIncome - totalExpenses
  const weekendOver = weekendBudget > 0 && weekendExpenses > weekendBudget

  // ── Spending per category this month ─────────────────────────────────
  const categorySpending = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; color: string; spent: number }>()
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const key = t.category_id ?? '__none__'
      const name = t.categories?.name ?? 'Uncategorized'
      const icon = t.categories?.icon ?? '💰'
      const color = t.categories?.color ?? '#64748b'
      const existing = map.get(key) ?? { name, icon, color, spent: 0 }
      existing.spent += t.amount
      map.set(key, existing)
    })
    return map
  }, [transactions])

  // Expense-type categories only (for the budget form selector)
  const expenseCategories = categories.filter(c => c.type === 'expense' || c.type === 'both')

  // Categories that already have a budget set
  const budgetedCategoryIds = new Set(budgets.map(b => b.category_id ?? '__none__'))

  // ── Save weekend budget ───────────────────────────────────────────────
  async function handleSaveWb() {
    setSaving(true)
    const val = parseFloat(wbEditValue) || 0
    const { error } = await supabase.from('profiles').update({ weekend_budget: val }).eq('id', userId)
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' })
    } else {
      setWeekendBudget(val)
      toast({ title: 'Weekend Pocket updated!' })
      setWbEditOpen(false)
      router.refresh()
    }
    setSaving(false)
  }

  // ── Save category budget ──────────────────────────────────────────────
  async function handleSaveBudget() {
    if (!budgetForm.amount || parseFloat(budgetForm.amount) <= 0) {
      toast({ title: 'Enter a budget amount', variant: 'destructive' })
      return
    }
    setSaving(true)

    const cat = categories.find(c => c.id === budgetForm.category_id)
    const today = new Date().toISOString().split('T')[0]
    const payload = {
      category_id: budgetForm.category_id || null,
      name: cat?.name ?? 'General',
      amount: parseFloat(budgetForm.amount),
      period: 'monthly' as const,
      start_date: today,
      alert_threshold: 80,
      is_active: true,
    }

    if (editingBudget) {
      const { data, error } = await supabase
        .from('budgets')
        .update({ amount: payload.amount, category_id: payload.category_id, name: payload.name })
        .eq('id', editingBudget.id)
        .select()
        .single()
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        setBudgets(prev => prev.map(b => b.id === editingBudget.id ? data as Budget : b))
        toast({ title: 'Budget updated' })
        setBudgetDialogOpen(false)
      }
    } else {
      const { data, error } = await supabase
        .from('budgets')
        .insert({ ...payload, user_id: userId })
        .select()
        .single()
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        setBudgets(prev => [...prev, data as Budget])
        toast({ title: 'Budget set!' })
        setBudgetDialogOpen(false)
      }
    }
    setSaving(false)
    router.refresh()
  }

  async function handleDeleteBudget(id: string) {
    setDeleting(id)
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) {
      toast({ title: 'Error', variant: 'destructive' })
    } else {
      setBudgets(prev => prev.filter(b => b.id !== id))
      toast({ title: 'Budget removed' })
    }
    setDeleting(null)
    router.refresh()
  }

  function openAdd() {
    setEditingBudget(null)
    setBudgetForm(EMPTY_BUDGET_FORM)
    setBudgetDialogOpen(true)
  }

  function openEdit(b: Budget) {
    setEditingBudget(b)
    setBudgetForm({ category_id: b.category_id ?? '', amount: String(b.amount) })
    setBudgetDialogOpen(true)
  }

  // ── Budget bar component ──────────────────────────────────────────────
  function BudgetBar({ budget }: { budget: Budget }) {
    const spending = categorySpending.get(budget.category_id ?? '__none__')
    const cat = categories.find(c => c.id === budget.category_id)
    const icon = cat?.icon ?? spending?.icon ?? '💰'
    const name = cat?.name ?? spending?.name ?? budget.name
    const color = cat?.color ?? spending?.color ?? '#6366f1'
    const spent = spending?.spent ?? 0
    const pct = Math.min(Math.round((spent / budget.amount) * 100), 100)
    const over = spent > budget.amount
    const remaining = budget.amount - spent

    return (
      <div className="space-y-2 py-3 border-b border-border last:border-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-base shrink-0" style={{ background: color + '22' }}>
              {icon}
            </div>
            <div>
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">
                {over
                  ? <span className="text-red-400">₹{Math.round(spent - budget.amount).toLocaleString('en-IN')} over</span>
                  : `₹${Math.round(remaining).toLocaleString('en-IN')} left`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`text-sm font-semibold ${over ? 'text-red-400' : ''}`}>
                {formatCurrency(spent)}
                <span className="text-muted-foreground font-normal"> / {formatCurrency(budget.amount)}</span>
              </p>
              <p className="text-xs text-muted-foreground">{pct}%</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(budget)} className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDeleteBudget(budget.id)}
                disabled={deleting === budget.id}
                className="rounded p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <Progress
          value={pct}
          className="h-1.5"
          style={{ '--progress-color': over ? '#f87171' : color } as React.CSSProperties}
        />
        {over && (
          <Badge variant="destructive" className="text-[10px]">⚠️ Over budget by {formatCurrency(spent - budget.amount)}</Badge>
        )}
      </div>
    )
  }

  // Categories with spending this month but no budget set
  const unbudgetedWithSpending = Array.from(categorySpending.entries())
    .filter(([key]) => !budgetedCategoryIds.has(key))
    .map(([key, data]) => ({ key, ...data }))
    .filter(c => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)

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
          {effectiveIncome > 0 && (
            <div className="space-y-1.5">
              <div className="flex h-3 rounded-full overflow-hidden gap-px">
                <div className="bg-primary/70 transition-all" style={{ width: `${Math.min((weekdayExpenses / effectiveIncome) * 100, 100)}%` }} />
                <div className={`transition-all ${weekendOver ? 'bg-red-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min((weekendExpenses / effectiveIncome) * 100, 100 - (weekdayExpenses / effectiveIncome) * 100)}%` }} />
                <div className="bg-emerald-500/40 flex-1" />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/70 inline-block" /> Weekday</span>
                <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-sm inline-block ${weekendOver ? 'bg-red-400' : 'bg-amber-400'}`} /> Weekend</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/40 inline-block" /> Free</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Category Budgets ── */}
        <div className="flora-card p-5 space-y-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="label-spaced">Category Budgets</p>
              <p className="text-xs text-muted-foreground mt-0.5">Set monthly spend limits per category</p>
            </div>
            <Button size="sm" variant="outline" onClick={openAdd} className="gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" /> Add Budget
            </Button>
          </div>

          {budgets.length === 0 ? (
            <div className="rounded-xl bg-accent/50 px-4 py-6 text-center space-y-2">
              <p className="text-2xl">💸</p>
              <p className="text-sm text-muted-foreground">No category budgets yet.</p>
              <p className="text-xs text-muted-foreground">Set limits for Food, Shopping, Entertainment etc. and we&apos;ll track spending against them automatically.</p>
              <Button size="sm" variant="outline" onClick={openAdd} className="mt-2">
                Set your first budget
              </Button>
            </div>
          ) : (
            <div>
              {budgets.map(b => <BudgetBar key={b.id} budget={b} />)}
            </div>
          )}

          {/* Unbudgeted categories with spending */}
          {unbudgetedWithSpending.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground label-spaced">No budget set</p>
              {unbudgetedWithSpending.map(c => (
                <div key={c.key} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full text-sm" style={{ background: c.color + '22' }}>
                      {c.icon}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{formatCurrency(c.spent)}</p>
                    <button
                      onClick={() => {
                        const cat = categories.find(cat => cat.name === c.name)
                        setBudgetForm({ category_id: cat?.id ?? '', amount: '' })
                        setEditingBudget(null)
                        setBudgetDialogOpen(true)
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Set limit
                    </button>
                  </div>
                </div>
              ))}
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
              onClick={() => { setWbEditValue(String(weekendBudget || '')); setWbEditOpen(true) }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Pencil className="h-3 w-3" />
              {weekendBudget > 0 ? 'Edit' : 'Set budget'}
            </button>
          </div>

          {weekendBudget === 0 ? (
            <div className="rounded-xl bg-amber-500/8 border border-amber-400/20 px-4 py-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No weekend budget set yet.</p>
              <Button size="sm" variant="outline" className="border-amber-400/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={() => { setWbEditValue(''); setWbEditOpen(true) }}>
                🎉 Set Weekend Budget
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Weekend spending this month</span>
                <span className={`font-semibold ${weekendOver ? 'text-red-400' : ''}`}>
                  {formatCurrency(weekendExpenses)} <span className="text-muted-foreground font-normal">/ {formatCurrency(weekendBudget)}</span>
                </span>
              </div>
              <Progress
                value={weekendBudget > 0 ? Math.min(Math.round((weekendExpenses / weekendBudget) * 100), 100) : 0}
                className="h-1.5"
                style={{ '--progress-color': weekendOver ? '#f87171' : '#f59e0b' } as React.CSSProperties}
              />
              <p className="text-xs text-muted-foreground">
                {weekendOver
                  ? `⚠️ ${formatCurrency(weekendExpenses - weekendBudget)} over your weekend limit`
                  : `${formatCurrency(weekendBudget - weekendExpenses)} remaining · ~${formatCurrency(weekendBudget / 4)} per weekend`
                }
              </p>
            </div>
          )}
        </div>

        {/* Goals Pocket */}
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
                      <span className="flex items-center gap-2"><span>{g.icon}</span><span className="font-medium">{g.name}</span></span>
                      <span className="text-muted-foreground text-xs">{formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}</span>
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
                {formatCurrency(goalsAutoSaveMonthly)}/month reserved across {goals.filter(g => g.auto_save_amount > 0).length} goal{goals.filter(g => g.auto_save_amount > 0).length !== 1 ? 's' : ''}.
              </p>
            )}
          </div>
        )}

      </div>

      {/* Add/Edit Category Budget Dialog */}
      <Dialog open={budgetDialogOpen} onOpenChange={v => { if (!v) setBudgetDialogOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-light">
              {editingBudget ? 'Edit Budget' : 'Set Category Budget'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={budgetForm.category_id}
                onValueChange={v => setBudgetForm(f => ({ ...f, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category…" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories
                    .filter(c => editingBudget ? true : !budgetedCategoryIds.has(c.id))
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Monthly limit (₹)</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 4000"
                value={budgetForm.amount}
                onChange={e => setBudgetForm(f => ({ ...f, amount: e.target.value }))}
                autoFocus={!budgetForm.category_id}
              />
            </div>
            {budgetForm.category_id && budgetForm.amount && parseFloat(budgetForm.amount) > 0 && (() => {
              const cat = categories.find(c => c.id === budgetForm.category_id)
              const spent = categorySpending.get(budgetForm.category_id)?.spent ?? 0
              const limit = parseFloat(budgetForm.amount)
              return spent > 0 ? (
                <div className="rounded-lg bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
                  You&apos;ve already spent <span className="font-medium text-foreground">{formatCurrency(spent)}</span> on {cat?.name} this month.{' '}
                  {spent > limit
                    ? <span className="text-red-400">That&apos;s already over this limit.</span>
                    : <span className="text-emerald-500">{formatCurrency(limit - spent)} would remain.</span>
                  }
                </div>
              ) : null
            })()}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBudgetDialogOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSaveBudget} disabled={saving}>
              {saving ? 'Saving…' : editingBudget ? 'Update' : 'Set Budget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Weekend Budget dialog */}
      <Dialog open={wbEditOpen} onOpenChange={setWbEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🎉 Weekend Pocket Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set how much you allow yourself to spend on Saturdays &amp; Sundays each month.
            </p>
            <div className="space-y-1.5">
              <Label>Monthly weekend budget (₹)</Label>
              <Input
                type="number" min="0" placeholder="e.g. 5000"
                value={wbEditValue}
                onChange={e => setWbEditValue(e.target.value)}
                autoFocus
              />
            </div>
            {wbEditValue && parseFloat(wbEditValue) > 0 && (
              <p className="text-xs text-muted-foreground">
                That&apos;s about {formatCurrency(parseFloat(wbEditValue) / 4)} per weekend.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWbEditOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSaveWb} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
