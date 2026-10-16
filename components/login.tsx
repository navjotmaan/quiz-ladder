'use client'
import { createClient } from '@/lib/supabase/client'

export default function LoginButton() {
  const login = () =>
    createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  return <button onClick={login} className="relative z-20 rounded-lg bg-blue-600 px-3 py-2 md:px-6 md:py-3 md:text-lg text-sm font-bold cursor-pointer text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30 active:translate-y-0">Start playing</button>
}