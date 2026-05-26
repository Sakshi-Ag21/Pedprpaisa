-- ============================================================
-- PedprPaisa - Complete Supabase Database Schema
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  currency TEXT DEFAULT 'INR',
  monthly_salary DECIMAL(12, 2) DEFAULT 0,
  salary_date INTEGER DEFAULT 1, -- Day of month
  financial_year_start INTEGER DEFAULT 4, -- April (India)
  pin_hash TEXT, -- Optional PIN lock
  theme TEXT DEFAULT 'dark',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#6366f1',
  type TEXT CHECK (type IN ('income', 'expense', 'both')) DEFAULT 'expense',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense', 'transfer')) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('upi', 'card', 'cash', 'bank_transfer', 'other')) DEFAULT 'upi',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  emotional_tag TEXT CHECK (emotional_tag IN ('planned', 'impulse', 'stress', 'necessity', 'joy', 'regret')),
  merchant TEXT,
  location TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  receipt_url TEXT,
  ai_categorized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUDGETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  period TEXT CHECK (period IN ('monthly', 'quarterly', 'yearly')) DEFAULT 'monthly',
  start_date DATE NOT NULL,
  end_date DATE,
  alert_threshold INTEGER DEFAULT 80, -- percentage
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GOALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(12, 2) NOT NULL,
  current_amount DECIMAL(12, 2) DEFAULT 0,
  target_date DATE,
  category TEXT CHECK (category IN ('emergency_fund', 'travel', 'gadget', 'education', 'investment', 'housing', 'vehicle', 'wedding', 'other')) DEFAULT 'other',
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#6366f1',
  status TEXT CHECK (status IN ('active', 'completed', 'paused', 'cancelled')) DEFAULT 'active',
  auto_save_amount DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GOAL CONTRIBUTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  note TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  billing_cycle TEXT CHECK (billing_cycle IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')) DEFAULT 'monthly',
  next_billing_date DATE NOT NULL,
  category TEXT DEFAULT 'Entertainment',
  icon TEXT DEFAULT '📱',
  color TEXT DEFAULT '#6366f1',
  status TEXT CHECK (status IN ('active', 'cancelled', 'paused')) DEFAULT 'active',
  auto_renew BOOLEAN DEFAULT TRUE,
  reminder_days INTEGER DEFAULT 3,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REPORTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('monthly', 'quarterly', 'yearly', 'custom')) NOT NULL,
  title TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVESTMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('mutual_fund', 'stocks', 'fd', 'ppf', 'nps', 'gold', 'real_estate', 'crypto', 'other')) DEFAULT 'other',
  invested_amount DECIMAL(12, 2) NOT NULL,
  current_value DECIMAL(12, 2),
  units DECIMAL(15, 6),
  purchase_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MIGRATION: Weekend Budget (run once in Supabase SQL editor)
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekend_budget DECIMAL(12, 2) DEFAULT 0;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Categories policies
CREATE POLICY "Users can manage own categories" ON public.categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view default categories" ON public.categories FOR SELECT USING (is_default = TRUE OR auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);

-- Budgets policies
CREATE POLICY "Users can manage own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id);

-- Goals policies
CREATE POLICY "Users can manage own goals" ON public.goals FOR ALL USING (auth.uid() = user_id);

-- Goal contributions policies
CREATE POLICY "Users can manage own goal contributions" ON public.goal_contributions FOR ALL USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can manage own subscriptions" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);

-- Reports policies
CREATE POLICY "Users can manage own reports" ON public.reports FOR ALL USING (auth.uid() = user_id);

-- Investments policies
CREATE POLICY "Users can manage own investments" ON public.investments FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DEFAULT CATEGORIES
-- ============================================================
INSERT INTO public.categories (id, user_id, name, icon, color, type, is_default) VALUES
  (uuid_generate_v4(), NULL, 'Salary', '💼', '#10b981', 'income', TRUE),
  (uuid_generate_v4(), NULL, 'Freelance', '💻', '#3b82f6', 'income', TRUE),
  (uuid_generate_v4(), NULL, 'Investments', '📈', '#6366f1', 'both', TRUE),
  (uuid_generate_v4(), NULL, 'Rent', '🏠', '#f59e0b', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Food & Dining', '🍽️', '#ef4444', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Transport', '🚗', '#8b5cf6', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Shopping', '🛍️', '#ec4899', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Bills & Utilities', '⚡', '#f97316', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Healthcare', '🏥', '#14b8a6', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Entertainment', '🎬', '#a855f7', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Family Support', '👨‍👩‍👧', '#06b6d4', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Education', '📚', '#84cc16', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Travel', '✈️', '#0ea5e9', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Subscriptions', '📱', '#d946ef', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Miscellaneous', '📦', '#64748b', 'expense', TRUE)
ON CONFLICT DO NOTHING;
