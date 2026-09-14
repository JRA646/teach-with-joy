import { useEffect, useState } from 'react'
import { Bell, CalendarCheck, CalendarClock, CalendarDays, GraduationCap, LayoutDashboard, LogOut, MessageCircle, UserRound, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getNavigationItems, getPermissions } from '../services/platform'
import type { NavigationItem, PermissionKey } from '../types/platform'
import Notifications from './Notifications'
import Messages from './Messages'
import EnhancedProfile from './Profile'
import TeacherDashboard from './TeacherDashboard'
import TeacherPrograms from './TeacherPrograms'
import TeacherProposals from './TeacherProposals'
import TeacherSchedule from './TeacherSchedule'
import TeacherAttendance from './TeacherAttendance'
import TeacherSubjects from './TeacherSubjects'

const getInitialPage = () => { const path = window.location.pathname; if (path === '/program' || path === '/teacher/programs') return 'programs'; if (path === '/proposals' || path === '/teacher/proposals') return 'proposals'; if (path === '/attendance' || path === '/teacher/attendance') return 'attendance'; if (path === '/schedule' || path === '/teacher/schedule') return 'schedule'; if (path === '/messages' || path === '/teacher/messages') return 'messages'; if (path === '/subjects' || path === '/teacher/subjects') return 'subjects'; if (path === '/profile' || path === '/teacher/profile') return 'profile'; return 'dashboard' }
const iconMap: Record<string, any> = { dashboard: LayoutDashboard, programs: GraduationCap, proposals: CalendarClock, schedule: CalendarDays, attendance: CalendarCheck, messages: MessageCircle, subjects: BookOpen, profile: UserRound }
const legacyNav: NavigationItem[] = [
  { key:'dashboard', label:'Dashboard', path:'/', sortOrder:0, enabled:true }, { key:'programs', label:'Students & Programs', path:'/program', sortOrder:1, enabled:true },
  { key:'proposals', label:'Lesson Proposals', path:'/proposals', sortOrder:2, enabled:true }, { key:'schedule', label:'Schedule', path:'/schedule', sortOrder:3, enabled:true },
  { key:'attendance', label:'Attendance', path:'/attendance', sortOrder:4, enabled:true }, { key:'messages', label:'Messages', path:'/messages', sortOrder:5, enabled:true },
  { key:'subjects', label:'Subjects', path:'/subjects', sortOrder:6, enabled:true }, { key:'profile', label:'Profile', path:'/profile', sortOrder:7, enabled:true },
]

export default function TeacherWorkspace({ profile }: { profile: any }) {
  const [page, setPage] = useState(getInitialPage), [notificationsOpen, setNotificationsOpen] = useState(false), [unread, setUnread] = useState(0), [nav, setNav] = useState<NavigationItem[]>(legacyNav), [permissions, setPermissions] = useState<PermissionKey[]>([])
  useEffect(() => { let active = true; Promise.all([getNavigationItems('teacher'), getPermissions('teacher')]).then(([items, perms]) => { if (active) { setNav(items); setPermissions(perms) } }); return () => { active = false } }, [])
  const canSee = (item: NavigationItem) => !item.permission || item.permission === 'dashboard.view' || permissions.includes(item.permission)
  const navigate = (next: string) => { const paths: Record<string,string> = { dashboard:'/', programs:'/program', proposals:'/proposals', schedule:'/schedule', attendance:'/attendance', messages:'/messages', subjects:'/subjects', profile:'/profile' }; const item = nav.find(x => x.key === next); window.history.pushState({},'',item?.path || paths[next] || '/'); setPage(next); window.scrollTo({top:0,behavior:'smooth'}) }
  useEffect(() => { let active=true; const loadUnread=async()=>{const {count}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_id',profile.id).is('read_at',null);if(active)setUnread(count||0)}; void loadUnread(); const channel=supabase.channel(`teacher-workspace:${profile.id}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`recipient_id=eq.${profile.id}`},()=>void loadUnread()).subscribe(); const onPop=()=>setPage(getInitialPage()); window.addEventListener('popstate',onPop); return()=>{active=false;supabase.removeChannel(channel);window.removeEventListener('popstate',onPop)} },[profile.id])
  return <div className="app-shell"><header className="app-header"><Brand/><div className="top-user"><button className="notification-button" title="Notifications" onClick={()=>setNotificationsOpen(true)}><Bell size={18}/>{unread>0&&<span className="notification-badge">{unread>99?'99+':unread}</span>}</button>{profile.avatar_url?<img className="user-avatar user-avatar-image" src={profile.avatar_url} alt="Profile"/>:<div className="user-avatar">{profile.full_name?.[0]||'T'}</div>}<div><strong>{profile.full_name}</strong><small>Teacher</small></div></div></header><div className="app-body"><aside className="sidebar"><div className="sidebar-section-label">TEACHING</div>{nav.filter(canSee).sort((a,b)=>a.sortOrder-b.sortOrder).map(item=>{const Icon=iconMap[item.key]||LayoutDashboard;return <button key={item.key} aria-label={item.label} className={page===item.key?'nav-item active':'nav-item'} onClick={()=>navigate(item.key)}><Icon size={17}/><span>{item.label}</span></button>})}<button className="nav-item bottom" onClick={()=>supabase.auth.signOut()}><LogOut size={17}/><span>Log Out</span></button></aside><main className="main-content">{page==='dashboard'&&<TeacherDashboard profile={profile} openPage={navigate}/>} {page==='programs'&&<TeacherPrograms profile={profile}/>} {page==='proposals'&&<TeacherProposals profile={profile}/>} {page==='schedule'&&<TeacherSchedule profile={profile} openPage={navigate}/>} {page==='attendance'&&<TeacherAttendance profile={profile}/>} {page==='messages'&&<Messages profile={profile}/>} {page==='subjects'&&<TeacherSubjects/>} {page==='profile'&&<EnhancedProfile profile={profile}/>}</main></div>{notificationsOpen&&<Notifications profile={profile} close={()=>setNotificationsOpen(false)}/>}</div>
}
function Brand(){return <button className="brand brand-link" onClick={()=>{window.history.pushState({},'','/');window.location.reload()}}><span className="brand-icon"><GraduationCap size={19}/></span><strong>TeachWithJoy</strong></button>}
