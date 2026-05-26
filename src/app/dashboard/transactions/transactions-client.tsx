'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { Plus, Search, Pencil, Trash2, ArrowUpCircle, Copy, LayoutList, LayoutGrid, MessageSquare } from 'lucide-react'
import { formatCurrency, formatDate, PAYMENT_METHODS, EMOTIONAL_TAGS, parseBankSMS, isWeekend } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import type { Transaction, Category } from '@/types/database'

type TxWithCat = Transaction & { categories: { name: string; icon: string; color: string } | null }

interface Props {
  transactions: TxWithCat[]
  categories: Category[]
  userId: string
  weekendBudget: number
}

const EMPTY_FORM = {
  title: '', amount: '', type: 'expense' as 'income' | 'expense',
  category_id: '', payment_method: 'upi' as Transaction['payment_method'],
  date: new Date().toISOString().split('T')[0], notes: '',
  emotional_tag: 'none' as Transaction['emotional_tag'] | 'none',
  merchant: '',
}

export function TransactionsClient({ transactions: initial, categories, userId, weekendBudget }: Props) {
  const [transactions, setTransactions] = useState(initial)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')
  const [view, setView] = useState<'list' | 'category'>('list')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TxWithCat | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TxWithCat | null>(null)
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsText, setSmsText] = useState('')
  const [smsError, setSmsError] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('new') === '1') openAdd()
  }, [])

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterCategory !== 'all' && (t.categories?.name ?? 'Uncategorized') !== filterCategory) return false
      if (filterMonth && !t.date.startsWith(filterMonth)) return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !t.categories?.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [transactions, filterType, filterCategory, filterMonth, search])

  // Group by category for category view
  const byCategory = useMemo(() => {
    const map = new Map<string, { icon: string; color: string; total: number; items: TxWithCat[] }>()
    filtered.forEach(t => {
      const name = t.categories?.name ?? 'Uncategorized'
      const icon = t.categories?.icon ?? '💰'
      const color = t.categories?.color ?? '#64748b'
      const existing = map.get(name) ?? { icon, color, total: 0, items: [] }
      existing.total += t.type === 'expense' ? t.amount : -t.amount
      existing.items.push(t)
      map.set(name, existing)
    })
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [filtered])

  // Unique category names for filter dropdown
  const categoryNames = useMemo(() => {
    const names = new Set(transactions.map(t => t.categories?.name ?? 'Uncategorized'))
    return Array.from(names).sort()
  }, [transactions])

  function handleSMSParse() {
    setSmsError('')
    const parsed = parseBankSMS(smsText)
    if (!parsed) {
      setSmsError('Could not read this message. Try a bank debit/credit SMS.')
      return
    }
    const matchedCat = categories.find(c =>
      (parsed.type === 'income' && (c.type === 'income' || c.type === 'both')) ||
      (parsed.type === 'expense' && (c.type === 'expense' || c.type === 'both'))
    )
    setEditing(null)
    setDuplicating(null)
    setForm({
      title: parsed.merchant ? `Payment at ${parsed.merchant}` : parsed.type === 'income' ? 'Amount Received' : 'Payment',
      amount: String(parsed.amount),
      type: parsed.type,
      category_id: matchedCat?.id ?? '',
      payment_method: parsed.payment_method,
      date: parsed.date,
      notes: '',
      emotional_tag: 'none',
      merchant: parsed.merchant,
    })
    setSmsOpen(false)
    setSmsText('')
    setOpen(true)
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(t: TxWithCat) {
    setEditing(t)
    setForm({
      title: t.title, amount: String(t.amount), type: t.type as 'income' | 'expense',
      category_id: t.category_id ?? '', payment_method: t.payment_method,
      date: t.date, notes: t.notes ?? '', emotional_tag: t.emotional_tag ?? 'none',
      merchant: t.merchant ?? '',
    })
    setOpen(true)
  }

  function openDuplicate(t: TxWithCat) {
    setEditing(null)
    setForm({
      title: t.title, amount: String(t.amount), type: t.type as 'income' | 'expense',
      category_id: t.category_id ?? '', payment_method: t.payment_method,
      date: new Date().toISOString().split('T')[0],
      notes: t.notes ?? '', emotional_tag: t.emotional_tag ?? 'none',
      merchant: t.merchant ?? '',
    })
    setDuplicating(t.id)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.title || !form.amount || !form.date) {
      toast({ title: 'Missing fields', description: 'Title, amount, and date are required.', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      amount: parseFloat(form.amount),
      type: form.type,
      category_id: form.category_id || null,
      payment_method: form.payment_method,
      date: form.date,
      notes: form.notes || null,
      emotional_tag: (form.emotional_tag === 'none' || !form.emotional_tag ? null : form.emotional_tag) as Transaction['emotional_tag'],
      merchant: form.merchant || null,
      user_id: userId,
    }

    if (editing) {
      const { data, error } = await supabase
        .from('transactions').update(payload).eq('id', editing.id)
        .select('*, categories(name, icon, color)').single()
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        setTransactions(prev => prev.map(t => t.id === editing.id ? data : t))
        toast({ title: 'Transaction updated' })
        setOpen(false)
      }
    } else {
      const { data, error } = await supabase
        .from('transactions').insert(payload)
        .select('*, categories(name, icon, color)').single()
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        setTransactions(prev => [data, ...prev])
        toast({ title: duplicating ? 'Transaction duplicated' : 'Transaction added' })
        setOpen(false)
        setDuplicating(null)
      }
    }
    setSaving(false)
    router.refresh()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const tx = deleteTarget
    setDeleting(tx.id)
    setDeleteTarget(null)
    const { error } = await supabase.from('transactions').delete().eq('id', tx.id)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setTransactions(prev => prev.filter(t => t.id !== tx.id))
      const amt = formatCurrency(tx.amount)
      if (tx.type === 'expense') {
        toast({ title: `${amt} back in your balance`, description: `"${tx.title}" removed from outflow` })
      } else {
        toast({ title: `${amt} removed from inflow`, description: `"${tx.title}" deleted` })
      }
    }
    setDeleting(null)
    router.refresh()
  }

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Weekend pocket: sum of expenses on Sat/Sun this calendar month (across all transactions, not just filtered)
  const weekendSpent = useMemo(() => {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(thisMonth) && isWeekend(t.date))
      .reduce((s, t) => s + t.amount, 0)
  }, [transactions])

  const weekendPct = weekendBudget > 0 ? Math.min(Math.round((weekendSpent / weekendBudget) * 100), 100) : 0
  const weekendOver = weekendBudget > 0 && weekendSpent > weekendBudget

  return (
    <div className="flex flex-col">
      <Topbar title="Transactions" description="Track every rupee in and out" />
      <div className="p-4 md:p-6 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Income', value: totalIncome, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/8' },
            { label: 'Expenses', value: totalExpenses, color: 'text-primary', bg: 'bg-primary/8' },
            { label: 'Net', value: totalIncome - totalExpenses, color: totalIncome - totalExpenses >= 0 ? 'text-green-600 dark:text-green-400' : 'text-primary', bg: 'bg-accent' },
          ].map(s => (
            <div key={s.label} className={`flora-card p-3 md:p-4 ${s.bg}`}>
              <p className="label-spaced">{s.label}</p>
              <p className={`font-serif text-xl font-light mt-1 ${s.color}`}>{formatCurrency(s.value)}</p>
            </div>
          ))}
        </div>

        {/* Weekend Pocket */}
        {weekendBudget > 0 && (
          <div className={`flora-card p-4 border ${weekendOver ? 'border-red-400/40 bg-red-500/5' : 'border-amber-400/20 bg-amber-500/5'}`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎉</span>
                <div>
                  <p className="text-sm font-medium">Weekend Pocket</p>
                  <p className="text-xs text-muted-foreground">Sat &amp; Sun spending this month</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${weekendOver ? 'text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {weekendOver ? `₹${Math.round(weekendSpent - weekendBudget).toLocaleString('en-IN')} over!` : `₹${Math.round(weekendBudget - weekendSpent).toLocaleString('en-IN')} left`}
                </p>
                <p className="text-xs text-muted-foreground">{weekendPct}% used</p>
              </div>
            </div>
            <Progress
              value={weekendPct}
              className="h-1.5"
              style={weekendOver ? { '--progress-color': '#f87171' } as React.CSSProperties : { '--progress-color': '#f59e0b' } as React.CSSProperties}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>Spent {formatCurrency(weekendSpent)}</span>
              <span>Budget {formatCurrency(weekendBudget)}</span>
            </div>
          </div>
        )}

        {/* Filters + view toggle + Add */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={v => setFilterType(v as 'all' | 'income' | 'expense')}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryNames.map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="month" className="w-36" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`px-2.5 py-2 transition-colors ${view === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('category')}
              className={`px-2.5 py-2 transition-colors ${view === 'category' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => { setSmsText(''); setSmsError(''); setSmsOpen(true) }} variant="outline" size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Paste SMS
          </Button>
          <Button onClick={openAdd} variant="bloom" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="flora-card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <ArrowUpCircle className="h-10 w-10 text-muted-foreground/30" strokeWidth={1} />
                <p className="text-sm text-muted-foreground font-light italic">No transactions found</p>
                <Button onClick={openAdd} variant="outline" size="sm" className="mt-1">Add your first transaction</Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-base">
                      {t.categories?.icon ?? '✦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm truncate">{t.title}</p>
                        {weekendBudget > 0 && t.type === 'expense' && isWeekend(t.date) && (
                          <Badge variant="secondary" className="text-[10px] shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">
                            🎉 weekend
                          </Badge>
                        )}
                        {t.emotional_tag && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {EMOTIONAL_TAGS.find(e => e.value === t.emotional_tag)?.emoji} {t.emotional_tag}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.categories?.name ?? 'Uncategorized'} · {formatDate(t.date)}
                        {t.payment_method && ` · ${t.payment_method.replace('_', ' ')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                        {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                      </p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openDuplicate(t)} title="Duplicate" className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openEdit(t)} title="Edit" className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          disabled={deleting === t.id}
                          title="Delete"
                          className="rounded-md p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CATEGORY VIEW */}
        {view === 'category' && (
          <div className="space-y-3">
            {byCategory.length === 0 ? (
              <div className="flora-card flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-sm text-muted-foreground font-light italic">No transactions found</p>
              </div>
            ) : (
              byCategory.map(cat => (
                <details key={cat.name} className="flora-card overflow-hidden group/cat">
                  <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-accent/30 transition-colors list-none">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base" style={{ background: cat.color + '22' }}>
                      {cat.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">{cat.items.length} transaction{cat.items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <p className={`text-sm font-medium ${cat.total >= 0 ? 'text-primary' : 'text-green-600 dark:text-green-400'}`}>
                      {formatCurrency(Math.abs(cat.total))}
                    </p>
                  </summary>
                  <div className="divide-y divide-border border-t border-border">
                    {cat.items.map(t => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors group">
                        <div className="flex-1 min-w-0 pl-12">
                          <p className="text-sm truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(t.date)}{t.payment_method ? ` · ${t.payment_method.replace('_', ' ')}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                            {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                          </p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openDuplicate(t)} title="Duplicate" className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => openEdit(t)} title="Edit" className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(t)}
                              disabled={deleting === t.id}
                              title="Delete"
                              className="rounded-md p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-light">Delete transaction?</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              {/* Transaction being deleted */}
              <div className="flex items-center gap-3 rounded-xl bg-accent/60 px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-base shrink-0">
                  {deleteTarget.categories?.icon ?? '✦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{deleteTarget.title}</p>
                  <p className="text-xs text-muted-foreground">{deleteTarget.categories?.name ?? 'Uncategorized'} · {formatDate(deleteTarget.date)}</p>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${deleteTarget.type === 'income' ? 'text-green-500' : 'text-primary'}`}>
                  {deleteTarget.type === 'income' ? '+' : '−'}{formatCurrency(deleteTarget.amount)}
                </p>
              </div>

              {/* Impact */}
              {deleteTarget.type === 'expense' ? (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-3 py-2.5 flex items-start gap-2">
                  <span className="text-base">💚</span>
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(deleteTarget.amount)} back in your balance
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Outflow will reduce by this amount</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-red-500/10 border border-red-400/20 px-3 py-2.5 flex items-start gap-2">
                  <span className="text-base">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(deleteTarget.amount)} removed from inflow
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Your available balance will decrease</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={!!deleting}
            >
              {deleting ? 'Deleting…' : 'Yes, delete it'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Parser Dialog */}
      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-light">Paste Bank SMS</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Paste any bank debit/credit SMS and we&apos;ll extract the details automatically.</p>
            <textarea
              className="w-full rounded-lg border border-border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[120px]"
              placeholder={`e.g. "Your A/c XXXX1234 is debited with Rs.1,500.00 on 09-May-25 at SWIGGY. UPI Ref: 123456"`}
              value={smsText}
              onChange={e => { setSmsText(e.target.value); setSmsError('') }}
            />
            {smsError && <p className="text-xs text-destructive">{smsError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSmsOpen(false)}>Cancel</Button>
            <Button variant="bloom" onClick={handleSMSParse} disabled={!smsText.trim()}>
              Parse & Fill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit/Duplicate Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setDuplicating(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-light">
              {editing ? 'Edit Transaction' : duplicating ? 'Duplicate Transaction' : 'Add Transaction'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex rounded-lg overflow-hidden border border-border">
              {(['expense', 'income'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setForm(f => ({ ...f, type }))}
                  className={`flex-1 py-2.5 text-sm transition-colors ${
                    form.type === type
                      ? type === 'expense' ? 'bg-petal text-primary font-medium' : 'bg-sage/30 text-green-700 dark:text-green-400 font-medium'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {type === 'expense' ? '↑ Expense' : '↓ Income'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="label-spaced">Title</Label>
                <Input placeholder="e.g. Zomato order" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="label-spaced">Amount (₹)</Label>
                <Input type="number" placeholder="0" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="label-spaced">Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="label-spaced">Category</Label>
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === form.type || c.type === 'both').map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="label-spaced">Payment Method</Label>
                <Select value={form.payment_method ?? 'upi'} onValueChange={v => setForm(f => ({ ...f, payment_method: v as Transaction['payment_method'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="label-spaced">Mood Tag</Label>
                <Select value={form.emotional_tag ?? 'none'} onValueChange={v => setForm(f => ({ ...f, emotional_tag: v as Transaction['emotional_tag'] | 'none' }))}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {EMOTIONAL_TAGS.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.emoji} {e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="label-spaced">Merchant</Label>
                <Input placeholder="e.g. Swiggy" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="label-spaced">Notes</Label>
                <Input placeholder="Optional note…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); setDuplicating(null) }}>Cancel</Button>
            <Button variant="bloom" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : duplicating ? 'Duplicate' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
