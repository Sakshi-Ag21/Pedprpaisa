'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, formatCompact } from '@/lib/utils'
import type { Investment } from '@/types/database'

interface Props { investments: Investment[]; userId: string }

const TYPES = [
  { value: 'mutual_fund', label: 'Mutual Fund', icon: '📊' },
  { value: 'stocks', label: 'Stocks', icon: '📈' },
  { value: 'fd', label: 'Fixed Deposit', icon: '🏦' },
  { value: 'ppf', label: 'PPF', icon: '🏛️' },
  { value: 'nps', label: 'NPS', icon: '🎯' },
  { value: 'gold', label: 'Gold', icon: '🥇' },
  { value: 'real_estate', label: 'Real Estate', icon: '🏠' },
  { value: 'crypto', label: 'Crypto', icon: '₿' },
  { value: 'other', label: 'Other', icon: '💰' },
]

const EMPTY_FORM = {
  name: '', type: 'mutual_fund', invested_amount: '', current_value: '',
  units: '', purchase_date: '', notes: '',
}

export function InvestmentsClient({ investments: initial, userId }: Props) {
  const [investments, setInvestments] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const totalInvested = investments.reduce((s, i) => s + i.invested_amount, 0)
  const totalCurrent = investments.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0)
  const totalGain = totalCurrent - totalInvested
  const gainPct = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(1) : '0'

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setOpen(true) }
  function openEdit(i: Investment) {
    setEditing(i)
    setForm({
      name: i.name, type: i.type, invested_amount: String(i.invested_amount),
      current_value: String(i.current_value ?? ''), units: String(i.units ?? ''),
      purchase_date: i.purchase_date ?? '', notes: i.notes ?? '',
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.invested_amount) {
      toast({ title: 'Missing fields', variant: 'destructive' }); return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(), type: form.type,
      invested_amount: parseFloat(form.invested_amount),
      current_value: form.current_value ? parseFloat(form.current_value) : null,
      units: form.units ? parseFloat(form.units) : null,
      purchase_date: form.purchase_date || null, notes: form.notes || null, user_id: userId,
    }

    if (editing) {
      const { data, error } = await supabase.from('investments').update(payload).eq('id', editing.id).select().single()
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }) }
      else { setInvestments(prev => prev.map(i => i.id === editing.id ? data : i)); toast({ title: 'Updated' }); setOpen(false) }
    } else {
      const { data, error } = await supabase.from('investments').insert(payload).select().single()
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }) }
      else { setInvestments(prev => [data, ...prev]); toast({ title: 'Investment added' }); setOpen(false) }
    }
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('investments').delete().eq('id', id)
    if (error) { toast({ title: 'Error', variant: 'destructive' }) }
    else { setInvestments(prev => prev.filter(i => i.id !== id)); toast({ title: 'Deleted' }) }
    router.refresh()
  }

  return (
    <div className="flex flex-col">
      <Topbar title="Investments" description="Track your wealth growth" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Total Invested</p>
            <p className="text-xl font-bold">{formatCompact(totalInvested)}</p>
          </div>
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Current Value</p>
            <p className="text-xl font-bold text-indigo-400">{formatCompact(totalCurrent)}</p>
          </div>
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Total Gain/Loss</p>
            <p className={`text-xl font-bold ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {totalGain >= 0 ? '+' : ''}{formatCompact(totalGain)}
            </p>
          </div>
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Returns</p>
            <p className={`text-xl font-bold ${parseFloat(gainPct) >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {gainPct}%
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={openAdd} variant="gradient" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Add Investment
          </Button>
        </div>

        {investments.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-16 gap-3">
            <TrendingUp className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No investments tracked yet</p>
            <Button onClick={openAdd} variant="outline" size="sm">Track Investment</Button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="divide-y divide-border">
              {investments.map(inv => {
                const current = inv.current_value ?? inv.invested_amount
                const gain = current - inv.invested_amount
                const gainPct = inv.invested_amount > 0 ? ((gain / inv.invested_amount) * 100).toFixed(1) : '0'
                const typeInfo = TYPES.find(t => t.value === inv.type)

                return (
                  <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-xl">
                      {typeInfo?.icon ?? '💰'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{inv.name}</p>
                      <p className="text-xs text-muted-foreground">{typeInfo?.label ?? inv.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(current)}</p>
                      <div className={`flex items-center gap-1 justify-end text-xs ${parseFloat(gainPct) >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {parseFloat(gainPct) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {gainPct}%
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(inv)} className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(inv.id)} className="rounded-md p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Investment' : 'Add Investment'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. Axis Bluechip Fund" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Invested Amount (₹) *</Label>
              <Input type="number" min="0" value={form.invested_amount} onChange={e => setForm(f => ({ ...f, invested_amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Current Value (₹)</Label>
              <Input type="number" min="0" placeholder="Optional" value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Units / Shares</Label>
              <Input type="number" min="0" step="0.000001" placeholder="Optional" value={form.units} onChange={e => setForm(f => ({ ...f, units: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Input placeholder="Optional…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
