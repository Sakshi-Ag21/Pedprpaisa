'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveProfile(data: {
  full_name: string
  monthly_salary: number
  salary_date: number
  currency: string
  weekend_budget: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', user.id)

  if (error) {
    console.error('Profile update error:', JSON.stringify(error))
    return { error: `${error.message} (code: ${error.code})` }
  }

  revalidatePath('/dashboard/settings')
  return { error: null }
}

export async function logSalaryThisMonth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('monthly_salary, salary_date')
    .eq('id', user.id)
    .single()

  if (!profile?.monthly_salary || profile.monthly_salary <= 0) {
    return { error: 'Set your monthly salary in settings first.' }
  }

  const now = new Date()
  const salaryDate = String(profile.salary_date ?? 1).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = `${now.getFullYear()}-${month}-${salaryDate}`

  // Check if salary already logged this month
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', user.id)
    .eq('type', 'income')
    .gte('date', `${now.getFullYear()}-${month}-01`)
    .lte('date', `${now.getFullYear()}-${month}-31`)
    .ilike('title', '%salary%')
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'Salary already logged for this month.' }
  }

  // Find salary category
  const { data: categories } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', '%salary%')
    .limit(1)

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    title: 'Monthly Salary',
    amount: profile.monthly_salary,
    type: 'income',
    category_id: categories?.[0]?.id ?? null,
    payment_method: 'bank_transfer',
    date,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
  return { error: null }
}

