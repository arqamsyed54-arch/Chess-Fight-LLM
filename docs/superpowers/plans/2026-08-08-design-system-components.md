# Design System Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create reusable Button, Card, and Input components with consistent styling and variants for the design system.

**Architecture:** Simple functional components using React forwardRef for ref forwarding, Tailwind CSS for styling, and TypeScript for type safety. Each component supports multiple variants for flexible usage.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4, Next.js 16

## Global Constraints

- React 19.2.8 and Next.js 16.3.0
- TypeScript strict mode
- Tailwind CSS 4 with PostCSS
- Components must be fully typed with proper prop interfaces
- Use forwardRef for all components

---

### Task 1: Create UI Directory and Button Component

**Files:**
- Create: `src/components/ui/Button.tsx`

**Interfaces:**
- Produces: `Button` component with props: `variant` (primary/secondary/accent/ghost), `size` (sm/md/lg), standard HTML button attributes

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p src/components/ui
```

- [ ] **Step 2: Create Button component**

Create file `src/components/ui/Button.tsx`:

```tsx
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

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

---

### Task 2: Create Card Component

**Files:**
- Create: `src/components/ui/Card.tsx`

**Interfaces:**
- Produces: `Card` component with props: `variant` (default/elevated/bordered), standard HTML div attributes

- [ ] **Step 1: Create Card component**

Create file `src/components/ui/Card.tsx`:

```tsx
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

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

---

### Task 3: Create Input Component

**Files:**
- Create: `src/components/ui/Input.tsx`

**Interfaces:**
- Produces: `Input` component with props: `label` (string), `error` (string), standard HTML input attributes

- [ ] **Step 1: Create Input component**

Create file `src/components/ui/Input.tsx`:

```tsx
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

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

---

### Task 4: Final Verification and Commit

**Files:**
- All files from Tasks 1-3

**Interfaces:**
- Consumes: All components created in Tasks 1-3
- Produces: Clean git commit with all components

- [ ] **Step 1: Run full TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 2: Stage all component files**

```bash
git add src/components/ui/Button.tsx src/components/ui/Card.tsx src/components/ui/Input.tsx
```

- [ ] **Step 3: Commit with descriptive message**

```bash
git commit -m "feat: add design system components (Button, Card, Input)"
```

- [ ] **Step 4: Write implementation report**

Create file `D:\sinkwakebot\.superpowers\sdd\2026-08-07-exam-heal-ai-phase0\task-5-report.md`:

```markdown
# Task 5 Report
Status: DONE

## What was implemented
- Button component with variants (primary, secondary, accent, ghost) and sizes (sm, md, lg)
- Card component with variants (default, elevated, bordered)
- Input component with label and error support

## Verification
- TypeScript compilation: PASS

## Commits
- [commit hash from Step 3]
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-08-design-system-components.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**