import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { getCurrentRoles, recordActivity } from './services/platform'
import ManagedPublicSite from './components/ManagedPublicSite'
import AdminSite from './components/AdminSite'
import GlobalSearch from './components/GlobalSearch'
import TeacherWorkspace from './components/TeacherWorkspace'
import StudentWorkspace from './components/StudentWorkspace'
import './program.css'
import './program-preferences.css'
import './workspace-professional.css'
import './teacher-workspace.css'
import './student-workspace.css'
import './ui-density.css'
import './platform-admin.css'

type Profile = Record<string, any> & { id: string; role?: string | null }

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const isAdminRoute = window.location.pathname.startsWith('/admin')

  async function loadProfile(id: string) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    if (error) { setProfile(null); setRoles([]); setLoading(false); return }
    setProfile((data as Profile | null) || null)
    try { setRoles(await getCurrentRoles()) } catch { setRoles(data?.role ? [data.role] : []) }
    setLoading(false)
  }

  useEffect(() => {
    if (isAdminRoute) { setLoading(false); return }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) void loadProfile(data.session.user.id)
      else setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      setSession(next)
      if (next) { void loadProfile(next.user.id); if (event === 'SIGNED_IN') void recordActivity('auth.signed_in', 'profile', next.user.id) }
      else { setProfile(null); setRoles([]); setLoading(false) }
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [isAdminRoute])

  useEffect(() => {
    if (!profile?.id || isAdminRoute) return
    const channel = supabase.channel(`profile-sync:${profile.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` }, () => void loadProfile(profile.id)).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [profile?.id, isAdminRoute])

  if (isAdminRoute) return <AdminSite />
  if (loading) return <div className="screen-loader">Loading TeachWithJoy...</div>
  if (!session || !profile) return <ManagedPublicSite />

  const role = roles[0] || profile.role || 'student'
  if (role === 'admin') return <AdminSite />

  return <><GlobalSearch onNavigate={path => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }}/>{role === 'teacher' ? <TeacherWorkspace profile={profile} /> : <StudentWorkspace profile={profile} />}</>
}
