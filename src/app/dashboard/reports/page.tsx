import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportsClient } from './reports-client'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load last 12 months of transactions
  const from = new Date()
  from.setMonth(from.getMonth() - 11)
  from.setDate(1)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, categories(name, icon, color)')
    .eq('user_id', user.id)
    .gte('date', from.toISOString().split('T')[0])
    .order('date', { ascending: false })

  return <ReportsClient transactions={transactions ?? []} />
}
