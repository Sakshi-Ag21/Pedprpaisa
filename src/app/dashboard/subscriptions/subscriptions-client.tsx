'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { Plus, Pencil, Trash2, RefreshCw, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/utils'
import type { Subscription } from '@/types/database'

interface Props { subscriptions: Subscription[]; userId: string }

const EMPTY_FORM = {
  name: '', description: '', amount: '', billing_cycle: 'monthly' as Subscription['billing_cycle'],
  next_billing_date: '', category: 'Entertainment', icon: '📱', color: '#6366f1',
  url: '', reminder_days: '3', auto_renew: true, status: 'active' as Subscription['status'],
}

const ICONS = ['📱', '🎬', '🎵', '📺', '🏋️', '☁️', '💼', '🎮', '📰', '🔧', '🛒', '✈️']
const SUB_CATEGORIES = ['Entertainment', 'Music', 'Productivity', 'Fitness', 'Cloud', 'News', 'Gaming', 'Shopping', 'Travel', 'Business', 'Education', 'Other']

export function SubscriptionsClient({ subscriptions: initial, userId }: Props) {
  const [subscriptions, setSubscriptions] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const active = subscriptions.filter(s => s.status === 'active')
  const monthlyTotal = active.reduce((sum, s) => {
    if (s.billing_cycle === 'monthly') return sum + s.amount
    if (s.billing_cycle === 'yearly') return sum + s.amount / 12
    if (s.billing_cycle === 'quarterly') return sum + s.amount / 3
    if (s.billing_cycle === 'weekly') return sum + s.amount * 4.33
    return sum + s.amount
  }, 0)

  const yearlyTotal = monthlyTotal * 12
  const upcomingCount = active.filter(s => getDaysUntil(s.next_billing_date) <= 7).length

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setOpen(true) }
  function openEdit(s: Subscription) {
    setEditing(s)
    setForm({
      name: s.name, description: s.description ?? '', amount: String(s.amount),
      billing_cycle: s.billing_cycle, next_billing_date: s.next_billing_date,
      category: s.category, icon: s.icon, color: s.color, url: s.url ?? '',
      reminder_days: String(s.reminder_days), auto_renew: s.auto_renew, status: s.status,
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.amount || !form.next_billing_date) {
      toast({ title: 'Missing fields', variant: 'destructive' }); return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(), description: form.description || null, amount: parseFloat(form.amount),
      billing_cycle: form.billing_cycle, next_billing_date: form.next_billing_date,
      category: form.category, icon: form.icon, color: form.color, url: form.url || null,
      reminder_days: parseInt(form.reminder_days), auto_renew: form.auto_renew, status: form.status,
      user_id: userId, currency: 'INR',
    }

    if (editing) {
      const { data, error } = await supabase.from('subscriptions').update(payload).eq('id', editing.id).select().single()
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }) }
      else { setSubscriptions(prev => prev.map(s => s.id === editing.id ? data : s)); toast({ title: 'Subscription updated' }); setOpen(false) }
    } else {
      const { data, error } = await supabase.from('subscriptions').insert(payload).select().single()
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }) }
      else { setSubscriptions(prev => [...prev, data]); toast({ title: 'Subscription added' }); setOpen(false) }
    }
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)
    if (error) { toast({ title: 'Error', variant: 'destructive' }) }
    else { setSubscriptions(prev => prev.filter(s => s.id !== id)); toast({ title: 'Subscription deleted' }) }
    router.refresh()
  }

  async function toggleStatus(sub: Subscription) {
    const newStatus = sub.status === 'active' ? 'cancelled' : 'active'
    const { data, error } = await supabase.from('subscriptions').update({ status: newStatus }).eq('id', sub.id).select().single()
    if (!error && data) setSubscriptions(prev => prev.map(s => s.id === sub.id ? data : s))
    router.refresh()
  }

  return (
    <div className="flex flex-col">
      <Topbar title="Subscriptions" description="Manage your recurring payments" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Monthly Cost</p>
            <p className="text-xl font-bold text-indigo-400">{formatCurrency(monthlyTotal)}</p>
          </div>
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Yearly Cost</p>
            <p className="text-xl font-bold">{formatCurrency(yearlyTotal)}</p>
          </div>
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Due This Week</p>
            <p className={`text-xl font-bold ${upcomingCount > 0 ? 'text-amber-500' : ''}`}>{upcomingCount}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={openAdd} variant="gradient" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Add Subscription
          </Button>
        </div>

        {subscriptions.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No subscriptions tracked</p>
            <Button onClick={openAdd} variant="outline" size="sm">Add One</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subscriptions.map(sub => {
              const days = getDaysUntil(sub.next_billing_date)
              const isDue = days <= 3 && days >= 0 && sub.status === 'active'

              return (
                <div key={sub.id} className={`glass-card p-4 space-y-3 group animate-fade-in ${sub.status === 'cancelled' ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                        style={{ background: `${sub.color}20` }}>
                        {sub.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{sub.name}</p>
                        <p className="text-xs text-muted-foreground">{sub.category}</p>
                      </div>
                    </div>
                    <Switch checked={sub.status === 'active'} onCheckedChange={() => toggleStatus(sub)} />
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold">{formatCurrency(sub.amount)}</p>
                      <p className="text-xs text-muted-foreground capitalize">/{sub.billing_cycle}</p>
                    </div>
                    <div className="text-right">
                      {isDue && (
                        <div className="flex items-center gap-1 text-xs text-amber-500 mb-1">
                          <AlertTriangle className="h-3 w-3" />
                          {days === 0 ? 'Due today' : `Due in ${days}d`}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Next: {formatDate(sub.next_billing_date)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(sub)} className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(sub.id)} className="rounded-md p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Subscription' : 'Add Subscription'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {ICONS.map(icon => (
                <button key={icon} onClick={() => setForm(f => ({ ...f, icon }))}
                  className={`text-xl p-1.5 rounded-lg transition-colors ${form.icon === icon ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-accent'}`}>
                  {icon}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Name *</Label>
                <Input placeholder="e.g. Netflix" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Cycle</Label>
                <Select value={form.billing_cycle} onValueChange={v => setForm(f => ({ ...f, billing_cycle: v as Subscription['billing_cycle'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['monthly', 'yearly', 'quarterly', 'weekly', 'daily'].map(c => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Next Billing Date *</Label>
                <Input type="date" value={form.next_billing_date} onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUB_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Remind (days before)</Label>
                <Input type="number" min="0" max="30" value={form.reminder_days} onChange={e => setForm(f => ({ ...f, reminder_days: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Website URL</Label>
                <Input type="url" placeholder="https://…" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <Switch checked={form.auto_renew} onCheckedChange={v => setForm(f => ({ ...f, auto_renew: v }))} id="auto_renew" />
                <Label htmlFor="auto_renew">Auto-renew</Label>
              </div>
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
