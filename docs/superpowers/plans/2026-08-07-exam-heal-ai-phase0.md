# Exam Heal AI — Phase 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Supabase project, database schema, auth, frontend scaffold, and design system — the foundation everything else builds on.

**Architecture:** Supabase backend (Postgres + Auth + Storage + Edge Functions), React/Next.js frontend with Tailwind CSS, Stripe billing skeleton.

**Tech Stack:** Supabase, Next.js, React, Tailwind CSS, TypeScript, Stripe

---

## File Structure

```
exam-heal-ai/
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 001_initial_schema.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   └── dashboard/page.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Input.tsx
│   │   └── layout/
│   │       ├── Navbar.tsx
│   │       └── Sidebar.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── stripe/
│   │       └── index.ts
│   └── types/
│       └── database.ts
├── public/
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Tasks

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.js`

**Interfaces:**
- Consumes: None
- Produces: Runnable Next.js app with TypeScript and Tailwind

- [ ] **Step 1: Create Next.js project**

```bash
npx create-next-app@latest exam-heal-ai --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

- [ ] **Step 2: Verify dev server starts**

```bash
cd exam-heal-ai && npm run dev
```
Expected: Server starts on http://localhost:3000

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Set Up Supabase Project

**Files:**
- Create: `supabase/config.toml`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

**Interfaces:**
- Consumes: None
- Produces: Supabase client configured for auth and database

- [ ] **Step 1: Install Supabase dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create Supabase client for browser**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create Supabase client for server**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Create .env.local template**

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add Supabase client configuration"
```

---

### Task 3: Create Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Interfaces:**
- Consumes: None
- Produces: Database tables for users, organizations, plans, papers, question_bank, templates, credit_transactions, api_keys, provider_usage_log, support_tickets

- [ ] **Step 1: Write migration SQL**

```sql
-- supabase/migrations/001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Plans table
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  monthly_credits INT NOT NULL,
  monthly_price_cents INT NOT NULL,
  max_papers_per_month INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (id, monthly_credits, monthly_price_cents, max_papers_per_month) VALUES
  ('free', 100, 0, 2),
  ('student', 5000, 999, NULL),
  ('teacher', 12500, 2499, NULL),
  ('school', 75000, 9999, NULL),
  ('institution', 125000, 19999, NULL);

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('school', 'institution')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('student', 'teacher', 'school_admin', 'institution_admin')) NOT NULL DEFAULT 'student',
  org_id UUID REFERENCES organizations(id),
  plan_id TEXT REFERENCES plans(id) DEFAULT 'free',
  credits_balance INT DEFAULT 100,
  papers_this_cycle INT DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Papers table
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  purpose TEXT NOT NULL,
  total_marks INT NOT NULL,
  total_questions INT NOT NULL,
  question_types JSONB NOT NULL DEFAULT '[]',
  template_id UUID,
  status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
  question_paper_url TEXT,
  answer_paper_url TEXT,
  solution_paper_url TEXT,
  credits_used INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Question Bank table
CREATE TABLE question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT NOT NULL,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  solution_text TEXT,
  source TEXT DEFAULT 'original',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  preview_url TEXT,
  layout_config JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Transactions table
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Provider Usage Log table
CREATE TABLE provider_usage_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL,
  key_index INT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets table
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  chat_transcript JSONB DEFAULT '[]',
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table (extensible)
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default subjects
INSERT INTO subjects (name) VALUES
  ('Mathematics'), ('Physics'), ('Chemistry'), ('Biology'),
  ('English'), ('History'), ('Geography'), ('Computer Science'),
  ('Economics'), ('Accountancy'), ('Business Studies'),
  ('Political Science'), ('Psychology'), ('Sociology'),
  ('Physical Education'), ('Environmental Science');

-- Indexes
CREATE INDEX idx_papers_user_id ON papers(user_id);
CREATE INDEX idx_papers_created_at ON papers(created_at DESC);
CREATE INDEX idx_question_bank_subject ON question_bank(subject);
CREATE INDEX idx_question_bank_difficulty ON question_bank(difficulty);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add initial database schema with RLS-ready tables"
```

---

### Task 4: Set Up Row-Level Security (RLS)

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

**Interfaces:**
- Consumes: Tables from Task 3
- Produces: RLS policies for all user-scoped tables

- [ ] **Step 1: Write RLS migration**

```sql
-- supabase/migrations/002_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Papers policies
CREATE POLICY "Users can view own papers" ON papers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own papers" ON papers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own papers" ON papers
  FOR UPDATE USING (auth.uid() = user_id);

-- Credit transactions policies
CREATE POLICY "Users can view own transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- API keys policies
CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys" ON api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Support tickets policies
CREATE POLICY "Users can view own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Question bank - readable by all authenticated users
CREATE POLICY "Authenticated users can view question bank" ON question_bank
  FOR SELECT USING (auth.role() = 'authenticated');

-- Templates - public templates readable by all, private by owner
CREATE POLICY "Public templates visible to all" ON templates
  FOR SELECT USING (is_public = true OR auth.uid() = owner_id);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add Row-Level Security policies"
```

---

### Task 5: Create Design System Components

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Input.tsx`

**Interfaces:**
- Consumes: Tailwind CSS config
- Produces: Reusable UI components matching design spec (Blue #2563EB primary, Orange #F97316 accent)

- [ ] **Step 1: Create Button component**

```tsx
// src/components/ui/Button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500',
      accent: 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500',
      ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-500'
    }
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    }
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
export default Button
```

- [ ] **Step 2: Create Card component**

```tsx
// src/components/ui/Card.tsx
import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-white rounded-xl shadow-sm',
      elevated: 'bg-white rounded-xl shadow-lg',
      bordered: 'bg-white rounded-xl border border-slate-200'
    }
    
    return (
      <div
        ref={ref}
        className={`${variants[variant]} ${className}`}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'
export default Card
```

- [ ] **Step 3: Create Input component**

```tsx
// src/components/ui/Input.tsx
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            error ? 'border-red-500' : ''
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add design system components (Button, Card, Input)"
```

---

### Task 6: Set Up Auth Pages

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`

**Interfaces:**
- Consumes: Supabase client from Task 2
- Produces: Login and signup pages with email/password and Google OAuth

- [ ] **Step 1: Create login page**

```tsx
// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Sign In</h1>
        
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        
        <div className="mt-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            Continue with Google
          </Button>
        </div>
        
        <p className="mt-6 text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <a href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </a>
        </p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create signup page**

```tsx
// src/app/(auth)/signup/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const handleGoogleSignup = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>
        
        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              I am a...
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'student' | 'teacher')}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          
          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>
        </form>
        
        <div className="mt-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleGoogleSignup}
          >
            Continue with Google
          </Button>
        </div>
        
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:underline">
            Sign in
          </a>
        </p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add login and signup pages with email/password and Google OAuth"
```

---

### Task 7: Create Dashboard Layout

**Files:**
- Create: `src/components/layout/Navbar.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: Supabase client, design system components
- Produces: Authenticated dashboard layout with sidebar navigation

- [ ] **Step 1: Create Navbar component**

```tsx
// src/components/layout/Navbar.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function Navbar() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold text-blue-600">Exam Heal AI</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-sm text-slate-600">
          <span className="font-medium">Credits:</span> 100
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create Sidebar component**

```tsx
// src/components/layout/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/generate', label: 'Generate Paper' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/question-bank', label: 'Question Bank' },
  { href: '/dashboard/templates', label: 'Templates' },
  { href: '/dashboard/settings', label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 min-h-[calc(100vh-4rem)]">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 3: Create Dashboard layout**

```tsx
// src/app/dashboard/layout.tsx
import Navbar from '@/components/layout/Navbar'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create Dashboard page**

```tsx
// src/app/dashboard/page.tsx
import Card from '@/components/ui/Card'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-slate-500">Papers Generated</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">0</p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-sm font-medium text-slate-500">Credits Remaining</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">100</p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-sm font-medium text-slate-500">Current Plan</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">Free</p>
        </Card>
      </div>
      
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <a
            href="/dashboard/generate"
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Generate Paper
          </a>
          <a
            href="/dashboard/question-bank"
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Browse Question Bank
          </a>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add dashboard layout with navbar and sidebar"
```

---

### Task 8: Set Up Stripe Integration

**Files:**
- Create: `src/lib/stripe/index.ts`
- Create: `src/app/api/stripe/checkout/route.ts`
- Create: `src/app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: Supabase client, plans from database
- Produces: Stripe checkout session creation and webhook handling

- [ ] **Step 1: Install Stripe dependencies**

```bash
npm install stripe @stripe/stripe-js
```

- [ ] **Step 2: Create Stripe client**

```typescript
// src/lib/stripe/index.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

export const PLANS = {
  free: { priceId: null, credits: 100, maxPapers: 2 },
  student: { priceId: process.env.STRIPE_STUDENT_PRICE_ID, credits: 5000 },
  teacher: { priceId: process.env.STRIPE_TEACHER_PRICE_ID, credits: 12500 },
  school: { priceId: process.env.STRIPE_SCHOOL_PRICE_ID, credits: 75000 },
  institution: { priceId: process.env.STRIPE_INSTITUTION_PRICE_ID, credits: 125000 },
} as const
```

- [ ] **Step 3: Create checkout route**

```typescript
// src/app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server'
import { stripe, PLANS } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId } = await request.json()

  if (planId === 'free') {
    return NextResponse.json({ error: 'Cannot purchase free plan' }, { status: 400 })
  }

  const plan = PLANS[planId as keyof typeof PLANS]
  if (!plan?.priceId) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { userId: user.id, planId },
  })

  return NextResponse.json({ sessionId: session.id })
}
```

- [ ] **Step 4: Create webhook route**

```typescript
// src/app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const supabase = await createClient()
    
    await supabase.from('users').update({
      plan_id: session.metadata?.planId,
      billing_cycle_start: new Date().toISOString(),
    }).eq('id', session.metadata?.userId)
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add Stripe checkout and webhook integration"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `npm run dev` starts without errors
- [ ] Can access http://localhost:3000
- [ ] Can sign up with email/password
- [ ] Can log in and see dashboard
- [ ] Dashboard shows correct layout with sidebar
- [ ] Database tables exist in Supabase
- [ ] RLS policies are active
