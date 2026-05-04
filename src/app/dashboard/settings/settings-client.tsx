'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveProfile, logSalaryThisMonth } from './actions'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { User, IndianRupee, Bell, Shield } from 'lucide-react'
import type { Profile } from '@/types/database'

interface Props { profile: Profile | null; userId: string; email: string }

export function SettingsClient({ profile, userId, email }: Props) {
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    monthly_salary: String(profile?.monthly_salary ?? ''),
    salary_date: String(profile?.salary_date ?? '1'),
    currency: profile?.currency ?? 'INR',
  })
  const [saving, setSaving] = useState(false)
  const [loggingSalary, setLoggingSalary] = useState(false)
  const router = useRouter()

  async function handleLogSalary() {
    setLoggingSalary(true)
    const { error } = await logSalaryThisMonth()
    if (error) {
      toast({ title: 'Could not log salary', description: error, variant: 'destructive' })
    } else {
      toast({ title: 'Salary logged!', description: 'Added as income in transactions.' })
      router.push('/dashboard/transactions')
    }
    setLoggingSalary(false)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await saveProfile({
      full_name: form.full_name,
      monthly_salary: parseFloat(form.monthly_salary) || 0,
      salary_date: parseInt(form.salary_date) || 1,
      currency: form.currency,
    })
    if (error) {
      toast({ title: 'Error saving', description: error, variant: 'destructive' })
    } else {
      toast({ title: 'Settings saved!' })
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col">
      <Topbar title="Settings" description="Manage your account preferences" />
      <div className="p-4 md:p-6 space-y-6 max-w-2xl">
        {/* Profile */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold">Profile</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">🇮🇳 INR — Indian Rupee</SelectItem>
                  <SelectItem value="USD">🇺🇸 USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">🇪🇺 EUR — Euro</SelectItem>
                  <SelectItem value="GBP">🇬🇧 GBP — British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Financial Settings */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <IndianRupee className="h-4 w-4 text-emerald-500" />
            </div>
            <h2 className="font-semibold">Financial</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Monthly Salary (₹)</Label>
              <Input type="number" min="0" placeholder="e.g. 80000" value={form.monthly_salary} onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Salary Date (day of month)</Label>
              <Select value={form.salary_date} onValueChange={v => setForm(f => ({ ...f, salary_date: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <SelectItem key={d} value={String(d)}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
              <Shield className="h-4 w-4 text-indigo-500" />
            </div>
            <h2 className="font-semibold">Security</h2>
          </div>
          <p className="text-sm text-muted-foreground">Your data is protected with Row Level Security in Supabase. Only you can access your financial data.</p>
          <div className="rounded-lg bg-accent/50 px-4 py-3 text-sm">
            <p className="font-medium">Account email</p>
            <p className="text-muted-foreground text-xs mt-0.5">{email}</p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button variant="gradient" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
          <Button variant="outline" onClick={handleLogSalary} disabled={loggingSalary} className="w-full sm:w-auto">
            {loggingSalary ? 'Logging…' : '💼 Log salary for this month'}
          </Button>
        </div>
      </div>
    </div>
  )
}
