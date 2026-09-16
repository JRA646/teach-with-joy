import { useEffect, useState } from 'react'
import { Bell, GraduationCap, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getNavigationItems, getPermissions } from '../services/platform'
import type { NavigationItem, PermissionKey } from '../types/platform'
import Notifications from './Notifications'
import { getWorkspacePageFromPath, getWorkspacePath, renderWorkspacePage, workspaceIcons } from '../lib/workspaceRuntime'

export default function TeacherWorkspace({ profile }: { profile: any }) {
  const [page, setPage] = useState(() => getWorkspacePageFromPath('teacher'))
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [nav, setNav] = useState<NavigationItem[]>([])
  const [permissions, setPermissions] = useState<PermissionKey[]>([])
  const [configLoading, setConfigLoading] = useState(true)

  useEffect(() => {
    let active = true
    setConfigLoading(true)
    Promise.all([getNavigationItems('teacher'), getPermissions('teacher')]).then(([items, perms]) => {
      if (!active) return
      setNav(items)
      setPermissions(perms)
      setConfigLoading(false)
    }).catch(() => { if (active) setConfigLoading(false) })
    return () => { active = false }
  }, [])

  const canSee = (item: NavigationItem) => !item.permission || item.permission === 'dashboard.view' || permissions.includes(item.permission)

  const navigate = (next: string) => {
    const path = getWorkspacePath('teacher', next, nav)
    window.history.pushState({}, '', path)
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    let active = true
    const loadUnread = async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', profile.id).is('read_at', null)
      if (active) setUnread(count || 0)
    }
    void loadUnread()
    const channel = supabase.channel(`teacher-workspace:${profile.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile.id}` }, () => void loadUnread()).subscribe()
    const onPop = () => setPage(getWorkspacePageFromPath('teacher'))
    window.addEventListener('popstate', onPop)
    return () => { active = false; void supabase.removeChannel(channel); window.removeEventListener('popstate', onPop) }
  }, [profile.id])

  return <div className="app-shell"><header className="app-header"><Brand/><div className="top-user"><button className="notification-button" title="Notifications" onClick={() => setNotificationsOpen(true)}><Bell size={18}/>{unread > 0 && <span className="notification-badge">{unread > 99 ? '99+' : unread}</span>}</button>{profile.avatar_url ? <img className="user-avatar user-avatar-image" src={profile.avatar_url} alt="Profile"/> : <div className="user-avatar">{profile.full_name?.[0] || 'T'}</div>}<div><strong>{profile.full_name}</strong><small>Teacher</small></div></div></header><div className="app-body"><aside className="sidebar"><div className="sidebar-section-label">TEACHING</div>{configLoading ? <div className="nav-loading">Loading navigation...</div> : nav.filter(canSee).sort((a, b) => a.sortOrder - b.sortOrder).map(item => { const Icon = workspaceIcons[item.key] || GraduationCap; return <button key={item.key} aria-label={item.label} className={page === item.key ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.key)}><Icon size={17}/><span>{item.label}</span></button> })}<button className="nav-item bottom" onClick={() => supabase.auth.signOut()}><LogOut size={17}/><span>Log Out</span></button></aside><main className="main-content">{renderWorkspacePage('teacher', page, profile, navigate)}</main></div>{notificationsOpen && <Notifications profile={profile} close={() => setNotificationsOpen(false)}/>}</div>
}

function Brand() { return <button className="brand brand-link" onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }}><span className="brand-icon"><GraduationCap size={19}/></span><strong>TeachWithJoy</strong></button> }
