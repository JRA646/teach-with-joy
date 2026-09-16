import type { ReactNode } from 'react'
import {
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
import Messages from '../components/Messages'
import EnhancedProfile from '../components/Profile'
import TeacherDashboard from '../components/TeacherDashboard'
import TeacherPrograms from '../components/TeacherPrograms'
import TeacherProposals from '../components/TeacherProposals'
import TeacherSchedule from '../components/TeacherSchedule'
import TeacherAttendance from '../components/TeacherAttendance'
import TeacherSubjects from '../components/TeacherSubjects'

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

const routesByRole: Record<string, RouteDefinition[]> = { teacher: teacherRoutes }

export function getWorkspaceRoutes(role: PlatformRole | string): RouteDefinition[] {
  return routesByRole[role] || []
}

export function getWorkspacePageFromPath(role: PlatformRole | string, path = window.location.pathname): string {
  return getWorkspaceRoutes(role).find(route => route.aliases.includes(path))?.key || 'dashboard'
}

export function getWorkspacePath(role: PlatformRole | string, key: string, navigation: NavigationItem[] = []): string {
  return navigation.find(item => item.key === key)?.path
    || getWorkspaceRoutes(role).find(route => route.key === key)?.aliases[0]
    || '/'
}

export function renderWorkspacePage(role: PlatformRole | string, key: string, profile: WorkspaceProfile, navigate: WorkspaceNavigator): ReactNode {
  const route = getWorkspaceRoutes(role).find(item => item.key === key)
  return route?.render(profile, navigate) || null
}
