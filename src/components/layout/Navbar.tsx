'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function Navbar() {
  const router = useRouter()
  
  const handleLogout = async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
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
