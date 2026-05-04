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
import { Plus, Search, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, Filter } from 'lucide-react'
import { formatCurrency, formatDate, PAYMENT_METHODS, EMOTIONAL_TAGS } from '@/lib/utils'
import type { Transaction, Category } from '@/types/database'

type TxWithCat = Transaction & { categories: { name: string; icon: string; color: string } | null }

interface Props {
  transactions: TxWithCat[]
  categories: Category[]
  userId: string
}

const EMPTY_FORM = {
  title: '', amount: '', type: 'expense' as 'income' | 'expense',
  category_id: '', payment_method: 'upi' as Transaction['payment_method'],
  date: new Date().toISOString().split('T')[0], notes: '',
  emotional_tag: 'none' as Transaction['emotional_tag'] | 'none',
  merchant: '',
}

export function TransactionsClient({ transactions: initial, categories, userId }: Props) {
  const [transactions, setTransactions] = useState(initial)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterMonth, setFilterMonth] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TxWithCat | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openAdd()
    }
  }, [])

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterMonth && !t.date.startsWith(filterMonth)) return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.categories?.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [transactions, filterType, filterMonth, search])

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
        .from('transactions')
        .update(payload)
        .eq('id', editing.id)
        .select('*, categories(name, icon, color)')
        .single()
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        setTransactions(prev => prev.map(t => t.id === editing.id ? data : t))
        toast({ title: 'Transaction updated' })
        setOpen(false)
      }
    } else {
      const { data, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select('*, categories(name, icon, color)')
        .single()
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        setTransactions(prev => [data, ...prev])
        toast({ title: 'Transaction added' })
        setOpen(false)
      }
    }
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setTransactions(prev => prev.filter(t => t.id !== id))
      toast({ title: 'Transaction deleted' })
    }
    setDeleting(null)
    router.refresh()
  }

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="flex flex-col">
      <Topbar title="Transactions" description="Track every rupee in and out" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Income', value: totalIncome, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Expenses', value: totalExpenses, color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: 'Net', value: totalIncome - totalExpenses, color: totalIncome - totalExpenses >= 0 ? 'text-indigo-400' : 'text-red-400', bg: 'bg-indigo-500/10' },
          ].map(s => (
            <div key={s.label} className={`glass-card p-3 md:p-4 ${s.bg}`}>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
            </div>
          ))}
        </div>

        {/* Filters + Add */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search transactions…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={v => setFilterType(v as 'all' | 'income' | 'expense')}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
          <Input type="month" className="w-36" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          <Button onClick={openAdd} variant="gradient" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {/* Transaction list */}
        <div className="glass-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <ArrowUpCircle className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No transactions found</p>
              <Button onClick={openAdd} variant="outline" size="sm" className="mt-1">Add your first transaction</Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-base">
                    {t.categories?.icon ?? '💰'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.title}</p>
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
                    <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-500' : 'text-red-400'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(t)} className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deleting === t.id}
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
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Type toggle */}
            <div className="flex rounded-lg overflow-hidden border border-border">
              {(['expense', 'income'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setForm(f => ({ ...f, type }))}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    form.type === type
                      ? type === 'expense' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-500'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {type === 'expense' ? '↑ Expense' : '↓ Income'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Title *</Label>
                <Input placeholder="e.g. Zomato order" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input type="number" placeholder="0" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
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
                <Label>Payment Method</Label>
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
                <Label>Mood Tag</Label>
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
                <Label>Merchant</Label>
                <Input placeholder="e.g. Swiggy" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Input placeholder="Optional note…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
