'use client'

import { useState } from 'react'
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
import { Plus, Pencil, Trash2, Target, PlusCircle } from 'lucide-react'
import { formatCurrency, formatDate, getDaysUntil, getProgressPercentage, GOAL_CATEGORIES } from '@/lib/utils'
import type { Goal } from '@/types/database'

interface Props { goals: Goal[]; userId: string }

const EMPTY_FORM = {
  name: '', description: '', target_amount: '', current_amount: '0',
  target_date: '', category: 'other', icon: '🎯', color: '#6366f1', auto_save_amount: '0',
}

const ICONS = ['🎯', '🛡️', '✈️', '💻', '📚', '📈', '🏠', '🚗', '💍', '🎓', '🏖️', '💎']
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

export function GoalsClient({ goals: initial, userId }: Props) {
  const [goals, setGoals] = useState(initial)
  const [open, setOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [contributeAmount, setContributeAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function openAdd() {
    setEditingGoal(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(g: Goal) {
    setEditingGoal(g)
    setForm({
      name: g.name, description: g.description ?? '',
      target_amount: String(g.target_amount), current_amount: String(g.current_amount),
      target_date: g.target_date ?? '', category: g.category, icon: g.icon,
      color: g.color, auto_save_amount: String(g.auto_save_amount),
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.target_amount) {
      toast({ title: 'Missing fields', variant: 'destructive' })
      return
    }
    setSaving(true)
    const base = {
      name: form.name.trim(),
      description: form.description || null,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount || '0'),
      target_date: form.target_date || null,
      category: form.category,
      icon: form.icon,
      color: form.color,
      auto_save_amount: parseFloat(form.auto_save_amount || '0'),
    }

    if (editingGoal) {
      const { data, error } = await supabase
        .from('goals')
        .update(base)
        .eq('id', editingGoal.id)
        .select()
        .single()
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }) }
      else { setGoals(prev => prev.map(g => g.id === editingGoal.id ? (data as Goal) : g)); toast({ title: 'Goal updated' }); setOpen(false) }
    } else {
      const { data, error } = await supabase
        .from('goals')
        .insert({ ...base, user_id: userId, status: 'active' })
        .select()
        .single()
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }) }
      else { setGoals(prev => [data as Goal, ...prev]); toast({ title: 'Goal created!' }); setOpen(false) }
    }
    setSaving(false)
    router.refresh()
  }

  async function handleContribute() {
    if (!contributeGoal || !contributeAmount) return
    const amount = parseFloat(contributeAmount)
    const newAmount = Math.min(contributeGoal.current_amount + amount, contributeGoal.target_amount)
    const isComplete = newAmount >= contributeGoal.target_amount

    const { error: contribError } = await supabase.from('goal_contributions').insert({
      goal_id: contributeGoal.id, user_id: userId, amount, date: new Date().toISOString().split('T')[0],
    })
    const { data, error } = await supabase.from('goals').update({
      current_amount: newAmount, status: isComplete ? 'completed' : 'active',
    }).eq('id', contributeGoal.id).select().single()

    if (contribError || error) {
      toast({ title: 'Error', variant: 'destructive' })
    } else {
      setGoals(prev => prev.map(g => g.id === contributeGoal.id ? data : g))
      toast({ title: isComplete ? '🎉 Goal completed!' : `+${formatCurrency(amount)} added` })
      setContributeOpen(false)
      setContributeAmount('')
    }
    router.refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) { toast({ title: 'Error', variant: 'destructive' }) }
    else { setGoals(prev => prev.filter(g => g.id !== id)); toast({ title: 'Goal deleted' }) }
    router.refresh()
  }

  const totalTarget = goals.filter(g => g.status === 'active').reduce((s, g) => s + g.target_amount, 0)
  const totalSaved = goals.filter(g => g.status === 'active').reduce((s, g) => s + g.current_amount, 0)

  return (
    <div className="flex flex-col">
      <Topbar title="Goals" description="Track your savings targets" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Active Goals</p>
            <p className="text-xl font-bold">{goals.filter(g => g.status === 'active').length}</p>
          </div>
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Total Saved</p>
            <p className="text-xl font-bold text-emerald-500">{formatCurrency(totalSaved)}</p>
          </div>
          <div className="glass-card p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Still Needed</p>
            <p className="text-xl font-bold text-indigo-400">{formatCurrency(totalTarget - totalSaved)}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={openAdd} variant="gradient" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> New Goal
          </Button>
        </div>

        {goals.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-16 gap-3">
            <Target className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No goals yet. Create your first savings goal!</p>
            <Button onClick={openAdd} variant="outline" size="sm">Create Goal</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map(goal => {
              const pct = getProgressPercentage(goal.current_amount, goal.target_amount)
              const daysLeft = goal.target_date ? getDaysUntil(goal.target_date) : null

              return (
                <div key={goal.id} className="glass-card p-5 space-y-4 animate-fade-in group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
                        style={{ background: `${goal.color}20` }}>
                        {goal.icon}
                      </div>
                      <div>
                        <p className="font-semibold">{goal.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{goal.category.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <Badge variant={goal.status === 'completed' ? 'success' : goal.status === 'paused' ? 'warning' : 'default'}>
                      {goal.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{formatCurrency(goal.current_amount)}</span>
                      <span className="text-muted-foreground">{formatCurrency(goal.target_amount)}</span>
                    </div>
                    <Progress value={pct} className="h-2" indicatorClassName={goal.status === 'completed' ? 'bg-emerald-500' : ''} style={{ '--progress-color': goal.color } as React.CSSProperties} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct}% complete</span>
                      {daysLeft !== null && (
                        <span className={daysLeft < 0 ? 'text-red-400' : daysLeft < 30 ? 'text-amber-500' : ''}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                        </span>
                      )}
                    </div>
                  </div>

                  {goal.status !== 'completed' && (
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      variant="outline"
                      onClick={() => { setContributeGoal(goal); setContributeOpen(true) }}
                    >
                      <PlusCircle className="h-4 w-4" /> Add Funds
                    </Button>
                  )}

                  <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(goal)} className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(goal.id)} className="rounded-md p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle></DialogHeader>
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
                <Label>Goal Name *</Label>
                <Input placeholder="e.g. Emergency Fund" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Target Amount (₹) *</Label>
                <Input type="number" min="0" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Already Saved (₹)</Label>
                <Input type="number" min="0" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target Date</Label>
                <Input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Monthly Auto-save (₹)</Label>
                <Input type="number" min="0" placeholder="0" value={form.auto_save_amount} onChange={e => setForm(f => ({ ...f, auto_save_amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap pt-1">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`h-6 w-6 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-background ring-white scale-110' : 'hover:scale-105'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editingGoal ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contribute Dialog */}
      <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Funds — {contributeGoal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Current: {formatCurrency(contributeGoal?.current_amount ?? 0)} / {formatCurrency(contributeGoal?.target_amount ?? 0)}
            </p>
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" min="1" placeholder="500" value={contributeAmount} onChange={e => setContributeAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContributeOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleContribute}>Add Funds</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
