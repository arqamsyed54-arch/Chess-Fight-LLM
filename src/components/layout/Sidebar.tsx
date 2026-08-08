'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/dashboard/analytics', icon: 'analytics', label: 'Analytics' },
  { href: '/dashboard/question-bank', icon: 'database', label: 'Question Bank' },
  { href: '/dashboard/ai-assistant', icon: 'smart_toy', label: 'AI Assistant' },
]

const footerItems = [
  { href: '/dashboard/settings', icon: 'settings', label: 'Settings' },
  { href: '/dashboard/support', icon: 'help', label: 'Support' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="bg-surface-container-low border-r border-outline-variant fixed left-0 top-0 h-screen w-64 flex flex-col py-6 px-4 z-40 hidden md:flex">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-sm">EH</span>
        </div>
        <div>
          <h1 className="text-[24px] leading-[1.4] font-extrabold text-on-surface">Exam Heal AI</h1>
          <p className="text-[12px] font-bold text-outline">Educator Portal</p>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  <span className={`material-symbols-outlined ${isActive ? 'icon-fill' : ''}`}>{item.icon}</span>
                  <span className="text-[14px] font-semibold">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-outline-variant pt-4 space-y-2">
        <button className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-on-primary rounded-lg text-[14px] font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm">
          <span className="material-symbols-outlined text-sm">add_circle</span>
          Upgrade Credits
        </button>
        <ul className="space-y-1 mt-2">
          {footerItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-highest transition-all rounded-lg">
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="text-[14px] font-semibold">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
