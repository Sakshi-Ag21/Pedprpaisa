import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCompact(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toFixed(0)}`
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date))
}

export function isWeekend(dateStr: string): boolean {
  // Parse as local date to avoid UTC shift issues
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const dow = d.getDay()
  return dow === 0 || dow === 6 // 0=Sun, 6=Sat
}

export function getDaysUntil(date: string | Date): number {
  const target = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function getProgressPercentage(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(Math.round((current / target) * 100), 100)
}

export function getCurrentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

export function getMonthName(monthIndex: number): string {
  return new Date(2024, monthIndex, 1).toLocaleString('en-IN', { month: 'short' })
}

export function calculateSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0
  return Math.round(((income - expenses) / income) * 100)
}

export function getFinancialHealthScore(
  savingsRate: number,
  budgetAdherence: number,
  goalProgress: number
): number {
  const savingsScore = Math.min(savingsRate * 2, 40) // max 40 pts
  const budgetScore = Math.min(budgetAdherence * 0.3, 30) // max 30 pts
  const goalScore = Math.min(goalProgress * 0.3, 30) // max 30 pts
  return Math.round(savingsScore + budgetScore + goalScore)
}

export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI', icon: '📲' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { value: 'other', label: 'Other', icon: '💰' },
]

export const EMOTIONAL_TAGS = [
  { value: 'planned', label: 'Planned', color: '#10b981', emoji: '✅' },
  { value: 'necessity', label: 'Necessity', color: '#3b82f6', emoji: '🎯' },
  { value: 'impulse', label: 'Impulse', color: '#f59e0b', emoji: '⚡' },
  { value: 'stress', label: 'Stress Spend', color: '#ef4444', emoji: '😰' },
  { value: 'joy', label: 'Joy', color: '#a855f7', emoji: '😊' },
  { value: 'regret', label: 'Regret', color: '#64748b', emoji: '😔' },
]

export interface ParsedSMS {
  amount: number
  type: 'income' | 'expense'
  merchant: string
  payment_method: 'upi' | 'card' | 'cash' | 'bank_transfer' | 'other'
  date: string
}

export function parseBankSMS(text: string): ParsedSMS | null {
  const t = text.trim()

  // Amount patterns: Rs.500, Rs 500, INR 500, ₹500, Rs.1,234.56
  const amountMatch = t.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i)
  if (!amountMatch) return null
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
  if (isNaN(amount) || amount <= 0) return null

  // Type: debit = expense, credit = income
  const isDebit = /debited|debit|spent|paid|payment|withdrawn|deducted|charged/i.test(t)
  const isCredit = /credited|credit|received|added|deposited|refund/i.test(t)
  if (!isDebit && !isCredit) return null
  const type: 'income' | 'expense' = isCredit ? 'income' : 'expense'

  // Merchant: "at MERCHANT", "to MERCHANT", "from MERCHANT", "VPA merchant@upi"
  let merchant = ''
  const atMatch = t.match(/(?:at|to|from|towards)\s+([A-Za-z0-9 &\-_\.@]+?)(?:\s+on|\s+via|\s+for|\s+ref|\s+upi|\.|,|$)/i)
  const vpaMatch = t.match(/vpa\s+([^\s]+)/i)
  if (atMatch) merchant = atMatch[1].trim()
  else if (vpaMatch) merchant = vpaMatch[1].split('@')[0].trim()

  // Payment method
  let payment_method: ParsedSMS['payment_method'] = 'other'
  if (/upi|gpay|phonepe|paytm|bhim/i.test(t)) payment_method = 'upi'
  else if (/card|credit card|debit card/i.test(t)) payment_method = 'card'
  else if (/neft|imps|rtgs|bank transfer/i.test(t)) payment_method = 'bank_transfer'
  else if (/cash/i.test(t)) payment_method = 'cash'

  const date = new Date().toISOString().split('T')[0]

  return { amount, type, merchant, payment_method, date }
}

export const GOAL_CATEGORIES = [
  { value: 'emergency_fund', label: 'Emergency Fund', icon: '🛡️' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'gadget', label: 'Gadget', icon: '💻' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'investment', label: 'Investment', icon: '📈' },
  { value: 'housing', label: 'Housing', icon: '🏠' },
  { value: 'vehicle', label: 'Vehicle', icon: '🚗' },
  { value: 'wedding', label: 'Wedding', icon: '💍' },
  { value: 'other', label: 'Other', icon: '🎯' },
]
