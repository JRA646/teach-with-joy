import { useEffect, useState } from 'react'
import { Bell, CalendarCheck, CalendarClock, CalendarDays, GraduationCap, LayoutDashboard, LogOut, MessageCircle, UserRound, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Notifications from './Notifications'
import Messages from './Messages'
import EnhancedProfile from './Profile'
import TeacherDashboard from './TeacherDashboard'
import TeacherPrograms from './TeacherPrograms'
import TeacherProposals from './TeacherProposals'
import TeacherSchedule from './TeacherSchedule'
import TeacherAttendance from './TeacherAttendance'
import TeacherSubjects from './TeacherSubjects'

const getInitialPage = () => {
  const path = window.location.pathname
  if (path === '/program' || path === '/teacher/programs') return 'programs'
  if (path === '/proposals' || path === '/teacher/proposals') return 'proposals'
  if (path === '/attendance' || path === '/teacher/attendance') return 'attendance'
  if (path === '/schedule' || path === '/teacher/schedule') return 'schedule'
  if (path === '/messages' || path === '/teacher/messages') return 'messages'
  if (path === '/subjects' || path === '/teacher/subjects') return 'subjects'
  if (path === '/profile' || path === '/teacher/profile') return 'profile'
  return 'dashboard'
}

export default function TeacherWorkspace({ profile }: { profile: any }) {
  const [page, setPage] = useState(getInitialPage)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const nav = [
    ['dashboard', 'Dashboard', LayoutDashboard], ['programs', 'Students & Programs', GraduationCap], ['proposals', 'Lesson Proposals', CalendarClock],
    ['schedule', 'Schedule', CalendarDays], ['attendance', 'Attendance', CalendarCheck], ['messages', 'Messages', MessageCircle], ['subjects', 'Subjects', BookOpen], ['profile', 'Profile', UserRound],
  ] as const
  const navigate = (next: string) => { const paths: Record<string,string> = { dashboard:'/', programs:'/program', proposals:'/proposals', schedule:'/schedule', attendance:'/attendance', messages:'/messages', subjects:'/subjects', profile:'/profile' }; window.history.pushState({},'',paths[next]||'/'); setPage(next); window.scrollTo({top:0,behavior:'smooth'}) }
  useEffect(() => { let active=true; const loadUnread=async()=>{const {count}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_id',profile.id).is('read_at',null); if(active)setUnread(count||0)}; void loadUnread(); const channel=supabase.channel(`teacher-workspace:${profile.id}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`recipient_id=eq.${profile.id}`},()=>void loadUnread()).subscribe(); const onPop=()=>setPage(getInitialPage()); window.addEventListener('popstate',onPop); return()=>{active=false;supabase.removeChannel(channel);window.removeEventListener('popstate',onPop)} },[profile.id])
  return <div className="app-shell"><header className="app-header"><Brand/><div className="top-user"><button className="notification-button" title="Notifications" onClick={()=>setNotificationsOpen(true)}><Bell size={18}/>{unread>0&&<span className="notification-badge">{unread>99?'99+':unread}</span>}</button>{profile.avatar_url?<img className="user-avatar user-avatar-image" src={profile.avatar_url} alt="Profile"/>:<div className="user-avatar">{profile.full_name?.[0]||'T'}</div>}<div><strong>{profile.full_name}</strong><small>Teacher</small></div></div></header><div className="app-body"><aside className="sidebar"><div className="sidebar-section-label">TEACHING</div>{nav.map(([id,label,Icon])=><button key={id} aria-label={label} className={page===id?'nav-item active':'nav-item'} onClick={()=>navigate(id)}><Icon size={17}/><span>{label}</span></button>)}<button className="nav-item bottom" onClick={()=>supabase.auth.signOut()}><LogOut size={17}/><span>Log Out</span></button></aside><main className="main-content">{page==='dashboard'&&<TeacherDashboard profile={profile} openPage={navigate}/>} {page==='programs'&&<TeacherPrograms profile={profile}/>} {page==='proposals'&&<TeacherProposals profile={profile}/>} {page==='schedule'&&<TeacherSchedule profile={profile} openPage={navigate}/>} {page==='attendance'&&<TeacherAttendance profile={profile}/>} {page==='messages'&&<Messages profile={profile}/>} {page==='subjects'&&<TeacherSubjects/>} {page==='profile'&&<EnhancedProfile profile={profile}/>}</main></div>{notificationsOpen&&<Notifications profile={profile} close={()=>setNotificationsOpen(false)}/>}</div>
}
function Brand(){return <button className="brand brand-link" onClick={()=>{window.history.pushState({},'','/');window.location.reload()}}><span className="brand-icon"><GraduationCap size={19}/></span><strong>TeachWithJoy</strong></button>}
