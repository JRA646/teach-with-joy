import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import ManagedPublicSite from './components/ManagedPublicSite'
import AdminSite from './components/AdminSite'
import TeacherWorkspace from './components/TeacherWorkspace'
import StudentWorkspace from './components/StudentWorkspace'
import './program.css'
import './program-preferences.css'
import './workspace-professional.css'
import './teacher-workspace.css'
import './student-workspace.css'
import './ui-density.css'

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const isAdminRoute = window.location.pathname.startsWith('/admin')
  async function loadProfile(id: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    setProfile(data); setLoading(false)
  }
  useEffect(() => {
    if (isAdminRoute) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) loadProfile(data.session.user.id); else setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (next) loadProfile(next.user.id); else { setProfile(null); setLoading(false) } })
    return () => data.subscription.unsubscribe()
  }, [isAdminRoute])
  useEffect(() => {
    if (!profile?.id || isAdminRoute) return
    const channel = supabase.channel(`profile-sync:${profile.id}`).on('postgres_changes', { event:'*', schema:'public', table:'profiles', filter:`id=eq.${profile.id}` }, () => loadProfile(profile.id)).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, isAdminRoute])
  if (isAdminRoute) return <AdminSite />
  if (loading) return <div className="screen-loader">Loading TeachWithJoy...</div>
  if (!session || !profile) return <ManagedPublicSite />
  if (profile.role === 'teacher') return <TeacherWorkspace profile={profile} />
  return <StudentWorkspace profile={profile} />
}
