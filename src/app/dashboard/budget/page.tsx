import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BudgetClient } from './budget-client'
import { getCurrentMonthRange } from '@/lib/utils'

export default async function BudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { start, end } = getCurrentMonthRange()

  const [{ data: transactions }, { data: goals }] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, type, date')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end),
    supabase.from('goals').select('name, icon, color, current_amount, target_amount, auto_save_amount').eq('user_id', user.id).eq('status', 'active'),
  ])

  // Fetch profile separately — weekend_budget may not exist until migration runs
  let monthlySalary = 0
  let weekendBudget = 0
  try {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    monthlySalary = (p as { monthly_salary?: number } | null)?.monthly_salary ?? 0
    weekendBudget = (p as { weekend_budget?: number } | null)?.weekend_budget ?? 0
  } catch { /* ignore */ }

  return (
    <BudgetClient
      weekendBudget={weekendBudget}
      monthlySalary={monthlySalary}
      transactions={transactions ?? []}
      goals={goals ?? []}
      userId={user.id}
    />
  )
}
