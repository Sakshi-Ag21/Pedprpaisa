export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          currency: string
          monthly_salary: number
          salary_date: number
          financial_year_start: number
          pin_hash: string | null
          theme: string
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      categories: {
        Row: {
          id: string
          user_id: string | null
          name: string
          icon: string
          color: string
          type: 'income' | 'expense' | 'both'
          is_default: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          title: string
          amount: number
          type: 'income' | 'expense' | 'transfer'
          payment_method: 'upi' | 'card' | 'cash' | 'bank_transfer' | 'other'
          date: string
          notes: string | null
          emotional_tag: 'planned' | 'impulse' | 'stress' | 'necessity' | 'joy' | 'regret' | null
          merchant: string | null
          location: string | null
          is_recurring: boolean
          receipt_url: string | null
          ai_categorized: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          name: string
          amount: number
          period: 'monthly' | 'quarterly' | 'yearly'
          start_date: string
          end_date: string | null
          alert_threshold: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['budgets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['budgets']['Insert']>
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          target_amount: number
          current_amount: number
          target_date: string | null
          category: string
          icon: string
          color: string
          status: 'active' | 'completed' | 'paused' | 'cancelled'
          auto_save_amount: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['goals']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['goals']['Insert']>
      }
      goal_contributions: {
        Row: {
          id: string
          goal_id: string
          user_id: string
          amount: number
          note: string | null
          date: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['goal_contributions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['goal_contributions']['Insert']>
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          amount: number
          currency: string
          billing_cycle: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
          next_billing_date: string
          category: string
          icon: string
          color: string
          status: 'active' | 'cancelled' | 'paused'
          auto_renew: boolean
          reminder_days: number
          url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
      }
      investments: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          invested_amount: number
          current_value: number | null
          units: number | null
          purchase_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['investments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['investments']['Insert']>
      }
      reports: {
        Row: {
          id: string
          user_id: string
          type: 'monthly' | 'quarterly' | 'yearly' | 'custom'
          title: string
          period_start: string
          period_end: string
          data: Json | null
          generated_at: string
        }
        Insert: Omit<Database['public']['Tables']['reports']['Row'], 'id' | 'generated_at'>
        Update: Partial<Database['public']['Tables']['reports']['Insert']>
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type Budget = Database['public']['Tables']['budgets']['Row']
export type Goal = Database['public']['Tables']['goals']['Row']
export type GoalContribution = Database['public']['Tables']['goal_contributions']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type Investment = Database['public']['Tables']['investments']['Row']
export type Report = Database['public']['Tables']['reports']['Row']

export type TransactionWithCategory = Transaction & {
  categories: Category | null
}
