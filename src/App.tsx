import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import PublicSite from './components/PublicSite'
import Workspace from './components/Workspace'

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(id: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    setProfile(data)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id)
      else setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) loadProfile(next.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`profile-sync:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` }, () => loadProfile(profile.id))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  if (loading) return <div className="screen-loader">Loading TeachWithJoy...</div>
  if (!session || !profile) return <PublicSite />
  return <Workspace profile={profile} refresh={() => loadProfile(profile.id)} />
}
