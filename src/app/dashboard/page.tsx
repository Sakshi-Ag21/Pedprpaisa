import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { getCurrentMonthRange } from '@/lib/utils'
import type { Transaction, Goal, Subscription, Profile, Investment, Category } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { start, end } = getCurrentMonthRange()

  const [
    { data: transactions },
    { data: goals },
    { data: subscriptions },
    { data: profile },
    { data: investments },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false }),
    supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'active'),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'active'),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('investments').select('*').eq('user_id', user.id),
    supabase.from('categories').select('*').or(`user_id.eq.${user.id},is_default.eq.true`).order('name'),
  ])

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)

  const { data: allTransactions } = await supabase
    .from('transactions')
    .select('amount, type, date, category_id, categories(name, color)')
    .eq('user_id', user.id)
    .gte('date', sixMonthsAgo.toISOString().split('T')[0])
    .order('date', { ascending: true })

  return (
    <DashboardClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactions={(transactions ?? []) as any}
      allTransactions={allTransactions ?? []}
      goals={(goals ?? []) as Goal[]}
      subscriptions={(subscriptions ?? []) as Subscription[]}
      profile={profile as Profile | null}
      investments={(investments ?? []) as Investment[]}
      categories={(categories ?? []) as Category[]}
      userId={user.id}
      weekendBudget={(profile as Profile | null)?.weekend_budget ?? 0}
    />
  )
}
