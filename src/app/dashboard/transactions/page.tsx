import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TransactionsClient } from './transactions-client'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(200),
    supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${user.id},is_default.eq.true`)
      .order('name'),
  ])

  // Fetch weekend_budget separately so a missing column never breaks the page
  let weekendBudget = 0
  try {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    weekendBudget = (p as { weekend_budget?: number } | null)?.weekend_budget ?? 0
  } catch { /* column may not exist yet */ }

  return (
    <TransactionsClient
      transactions={transactions ?? []}
      categories={categories ?? []}
      userId={user.id}
      weekendBudget={weekendBudget}
    />
  )
}
