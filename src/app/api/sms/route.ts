import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseBankSMS } from '@/lib/utils'

const SMS_SECRET = process.env.SMS_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sms, secret, user_email } = body

    if (!SMS_SECRET || secret !== SMS_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sms || typeof sms !== 'string') {
      return NextResponse.json({ error: 'Missing sms field' }, { status: 400 })
    }

    const parsed = parseBankSMS(sms)
    if (!parsed) {
      return NextResponse.json({ error: 'Could not parse SMS as a transaction' }, { status: 422 })
    }

    const supabase = createServiceClient()
    const email = user_email || process.env.SMS_DEFAULT_EMAIL

    if (!email) {
      return NextResponse.json({ error: 'No user email provided' }, { status: 400 })
    }

    // Look up user via auth.users (requires service role)
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) {
      return NextResponse.json({ error: `Auth error: ${authError.message}` }, { status: 500 })
    }

    const authUser = authData.users.find(u => u.email === email)
    if (!authUser) {
      return NextResponse.json({ error: `No auth user found for ${email}` }, { status: 404 })
    }

    const userId = authUser.id

    // Find best matching category
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, type')
      .or(`user_id.eq.${userId},is_default.eq.true`)

    let category_id = null
    if (categories) {
      const matched = categories.find((c: { id: string; name: string; type: string }) =>
        (parsed.type === 'income' && (c.type === 'income' || c.type === 'both')) ||
        (parsed.type === 'expense' && (c.type === 'expense' || c.type === 'both'))
      )
      category_id = matched?.id ?? null
    }

    // Insert transaction
    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        title: parsed.merchant ? `Payment at ${parsed.merchant}` : parsed.type === 'income' ? 'Amount Received' : 'Payment',
        amount: parsed.amount,
        type: parsed.type,
        category_id,
        payment_method: parsed.payment_method,
        date: parsed.date,
        notes: 'Auto-logged from SMS',
      })
      .select('id, title, amount, type')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, transaction })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
