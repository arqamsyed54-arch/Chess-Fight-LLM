'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
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
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl border border-outline-variant p-8 shadow-sm">
        <h1 className="text-[24px] leading-[1.4] font-semibold text-on-surface text-center mb-6">Sign In</h1>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-[14px] font-semibold text-on-surface mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow text-[16px]"
            />
          </div>
          <div>
            <label className="block text-[14px] font-semibold text-on-surface mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow text-[16px]"
            />
          </div>

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary text-[14px] font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-surface text-on-surface border border-outline-variant text-[14px] font-semibold py-3 rounded-lg hover:bg-surface-container-low transition-colors"
          >
            Continue with Google
          </button>
        </div>

        <p className="mt-6 text-center text-[14px] text-on-surface-variant">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-primary font-semibold hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
