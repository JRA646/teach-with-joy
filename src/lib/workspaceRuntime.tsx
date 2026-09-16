import type { ReactNode } from 'react'
import {
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  UserRound,
} from 'lucide-react'
import type { NavigationItem, PlatformRole } from '../types/platform'
import Notifications from '../components/Notifications'
import Messages from '../components/Messages'
import EnhancedProfile from '../components/Profile'
import TeacherDashboard from '../components/TeacherDashboard'
import TeacherPrograms from '../components/TeacherPrograms'
import TeacherProposals from '../components/TeacherProposals'
import TeacherSchedule from '../components/TeacherSchedule'
import TeacherAttendance from '../components/TeacherAttendance'
import TeacherSubjects from '../components/TeacherSubjects'
import ProgramWorkspace from '../components/ProgramWorkspace'
import ProgramPreferences from '../components/ProgramPreferences'
import StudentProposals from '../components/StudentProposals'

export type WorkspaceProfile = Record<string, any>
export type WorkspaceNavigator = (key: string) => void

type RouteDefinition = {
  key: string
  aliases: string[]
  render: (profile: WorkspaceProfile, navigate: WorkspaceNavigator) => ReactNode
}

export const workspaceIcons: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  programs: GraduationCap,
  program: GraduationCap,
  proposals: CalendarClock,
  schedule: CalendarDays,
  attendance: CalendarCheck,
  messages: MessageCircle,
  subjects: BookOpen,
  profile: UserRound,
}

const teacherRoutes: RouteDefinition[] = [
  { key: 'dashboard', aliases: ['/'], render: (profile, navigate) => <TeacherDashboard profile={profile} openPage={navigate} /> },
  { key: 'programs', aliases: ['/program', '/teacher/programs'], render: profile => <TeacherPrograms profile={profile} /> },
  { key: 'proposals', aliases: ['/proposals', '/teacher/proposals'], render: profile => <TeacherProposals profile={profile} /> },
  { key: 'schedule', aliases: ['/schedule', '/teacher/schedule'], render: (profile, navigate) => <TeacherSchedule profile={profile} openPage={navigate} /> },
  { key: 'attendance', aliases: ['/attendance', '/teacher/attendance'], render: profile => <TeacherAttendance profile={profile} /> },
  { key: 'messages', aliases: ['/messages', '/teacher/messages'], render: profile => <Messages profile={profile} /> },
  { key: 'subjects', aliases: ['/subjects', '/teacher/subjects'], render: () => <TeacherSubjects /> },
  { key: 'profile', aliases: ['/profile', '/teacher/profile'], render: profile => <EnhancedProfile profile={profile} /> },
]

const studentRoutes: RouteDefinition[] = [
  { key: 'dashboard', aliases: ['/'], render: (profile, navigate) => <StudentDashboardBridge profile={profile} openPage={navigate} /> },
  { key: 'program', aliases: ['/program', '/student/program'], render: profile => <div className="student-module-stack"><ProgramWorkspace profile={profile} /><ProgramPreferences profile={profile} /></div> },
  { key: 'proposals', aliases: ['/proposals', '/student/proposals'], render: profile => <StudentProposals profile={profile} /> },
  { key: 'schedule', aliases: ['/schedule', '/student/schedule'], render: (profile, navigate) => <StudentScheduleBridge profile={profile} openPage={navigate} /> },
  { key: 'messages', aliases: ['/messages', '/student/messages'], render: profile => <Messages profile={profile} /> },
  { key: 'profile', aliases: ['/profile', '/student/profile'], render: profile => <EnhancedProfile profile={profile} /> },
]

const routesByRole: Record<string, RouteDefinition[]> = {
  teacher: teacherRoutes,
  student: studentRoutes,
}

export function getWorkspaceRoutes(role: PlatformRole | string): RouteDefinition[] {
  return routesByRole[role] || []
}

export function getWorkspacePageFromPath(role: PlatformRole | string, path = window.location.pathname): string {
  const routes = getWorkspaceRoutes(role)
  return routes.find(route => route.aliases.includes(path))?.key || 'dashboard'
}

export function getWorkspacePath(role: PlatformRole | string, key: string, navigation: NavigationItem[] = []): string {
  return navigation.find(item => item.key === key)?.path
    || getWorkspaceRoutes(role).find(route => route.key === key)?.aliases[0]
    || '/'
}

export function renderWorkspacePage(
  role: PlatformRole | string,
  key: string,
  profile: WorkspaceProfile,
  navigate: WorkspaceNavigator,
): ReactNode {
  const route = getWorkspaceRoutes(role).find(item => item.key === key)
  return route?.render(profile, navigate) || null
}

export function getNotificationButton(
  unread: number,
  onOpen: () => void,
): ReactNode {
  return <button className="notification-button" title="Notifications" onClick={onOpen}><Bell size={18}/>{unread > 0 && <span className="notification-badge">{unread > 99 ? '99+' : unread}</span>}</button>
}

function StudentDashboardBridge({ profile, openPage }: { profile: WorkspaceProfile; openPage: WorkspaceNavigator }) {
  return <StudentDashboard profile={profile} openPage={openPage} />
}

function StudentScheduleBridge({ profile, openPage }: { profile: WorkspaceProfile; openPage: WorkspaceNavigator }) {
  return <StudentSchedule profile={profile} openPage={openPage} />
}

function StudentDashboard({ profile, openPage }: { profile: WorkspaceProfile; openPage: WorkspaceNavigator }) {
  return <StudentDashboardComponent profile={profile} openPage={openPage} />
}

function StudentSchedule({ profile, openPage }: { profile: WorkspaceProfile; openPage: WorkspaceNavigator }) {
  return <StudentScheduleComponent profile={profile} openPage={openPage} />
}

// The student dashboard and schedule live in StudentWorkspace today. The registry keeps
// routing centralized while allowing that component to supply the concrete implementations.
let StudentDashboardComponent: (props: { profile: WorkspaceProfile; openPage: WorkspaceNavigator }) => ReactNode = () => null
let StudentScheduleComponent: (props: { profile: WorkspaceProfile; openPage: WorkspaceNavigator }) => ReactNode = () => null

export function registerStudentWorkspacePages(
  dashboard: (props: { profile: WorkspaceProfile; openPage: WorkspaceNavigator }) => ReactNode,
  schedule: (props: { profile: WorkspaceProfile; openPage: WorkspaceNavigator }) => ReactNode,
) {
  StudentDashboardComponent = dashboard
  StudentScheduleComponent = schedule
}

export { Notifications }
