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
