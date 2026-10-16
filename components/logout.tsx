'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  return (
    <button onClick={async () => {
      await createClient().auth.signOut()
      router.push('/')
      router.refresh()
    }} className="rounded-lg bg-red-500 px-3 md:py-2 py-1 font-bold cursor-pointer text-sm text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-lg active:translate-y-0">Log out</button>
  )
}