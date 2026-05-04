# PedprPaisa — Personal Finance Tracker

A production-ready, premium personal finance web application built for salaried professionals in India.

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 + custom design system
- **Backend/Auth/DB**: Supabase (PostgreSQL + Auth)
- **Charts**: Recharts
- **Deployment**: Vercel

## Features

- Dashboard with income, expenses, savings, investments overview
- Transaction tracking with categories, payment methods, emotional tags
- Savings goals with progress tracking and contributions
- Subscription manager with renewal reminders
- Investment portfolio tracker
- Reports with CSV export and 12-month charts
- Google OAuth + email/password auth
- Dark/light mode
- Mobile-first responsive design
- Row Level Security (Supabase RLS)

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd pedprpaisa
npm install
```

### 2. Set up Supabase

1. Create a project at [app.supabase.com](https://app.supabase.com)
2. Go to SQL Editor and run `supabase/schema.sql`
3. Enable Google Auth in Authentication > Providers (optional)
4. Add your site URL in Authentication > URL Configuration

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

## Database Schema

Run `supabase/schema.sql` in your Supabase SQL Editor. It creates:

| Table | Purpose |
|-------|---------|
| `profiles` | User settings, salary info |
| `transactions` | All income/expense entries |
| `categories` | Default + custom categories |
| `goals` | Savings goals |
| `goal_contributions` | Goal fund additions |
| `subscriptions` | Recurring payments |
| `investments` | Investment portfolio |
| `budgets` | Category budgets |

All tables have Row Level Security — users can only access their own data.

## Project Structure

```
src/
  app/
    auth/           # Login, signup, OAuth callback
    dashboard/      # All app pages
      transactions/ # Expense/income tracking
      goals/        # Savings goals
      subscriptions/# Recurring payments
      investments/  # Portfolio tracker
      reports/      # Analytics & export
      settings/     # User preferences
  components/
    ui/             # Button, Input, Dialog, etc.
    layout/         # Sidebar, Topbar
    dashboard/      # Charts, StatCards
    providers/      # Auth, Theme
  lib/
    supabase/       # Client, server, middleware
    utils.ts        # Helpers, formatters
  types/
    database.ts     # TypeScript types
```

## Security

- Supabase RLS ensures data isolation per user
- Auth handled by Supabase (JWT-based)
- No sensitive data in client bundles
- HTTPS enforced on Vercel
- Input validation on all forms
