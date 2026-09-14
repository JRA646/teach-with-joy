import type { DashboardWidgetDefinition, NavigationItem, PermissionKey, PlatformFeatureFlags, PlatformRole } from '../types/platform'

export const DEFAULT_FEATURE_FLAGS: PlatformFeatureFlags = {
  'platform.dynamic_navigation': true,
  'platform.dashboard_widgets': true,
  'platform.activity_log': true,
  'platform.form_builder': false,
  'platform.workflow_engine': false,
  'platform.organizations': false,
  'platform.global_search': true,
  'platform.notifications': true,
}

const teacherNavigation: NavigationItem[] = [
  ['dashboard', 'Dashboard', '/', 'LayoutDashboard', 'TEACHING', 'dashboard.view'], ['programs', 'Students & Programs', '/program', 'GraduationCap', 'TEACHING', 'students.view'],
  ['proposals', 'Lesson Proposals', '/proposals', 'CalendarClock', 'TEACHING', 'programs.view'], ['schedule', 'Schedule', '/schedule', 'CalendarDays', 'TEACHING', 'schedule.view'],
  ['attendance', 'Attendance', '/attendance', 'CalendarCheck', 'TEACHING', 'attendance.view'], ['messages', 'Messages', '/messages', 'MessageCircle', 'TEACHING', 'messages.view'],
  ['subjects', 'Subjects', '/subjects', 'BookOpen', 'TEACHING', 'subjects.view'], ['profile', 'Profile', '/profile', 'UserRound', 'ACCOUNT', 'profile.view'],
].map(([key, label, path, icon, section, permission], sortOrder) => ({ key, label, path, icon, section, sortOrder, permission: permission as PermissionKey, enabled: true }))

const studentNavigation: NavigationItem[] = [
  ['dashboard', 'Dashboard', '/', 'LayoutDashboard', 'LEARNING', 'dashboard.view'], ['program', 'My Program', '/program', 'GraduationCap', 'LEARNING', 'programs.view'],
  ['proposals', 'Lesson Proposals', '/proposals', 'CalendarClock', 'LEARNING', 'programs.view'], ['schedule', 'Schedule', '/schedule', 'CalendarDays', 'LEARNING', 'schedule.view'],
  ['messages', 'Messages', '/messages', 'MessageCircle', 'LEARNING', 'messages.view'], ['profile', 'Profile', '/profile', 'UserRound', 'ACCOUNT', 'profile.view'],
].map(([key, label, path, icon, section, permission], sortOrder) => ({ key, label, path, icon, section, sortOrder, permission: permission as PermissionKey, enabled: true }))

export const DEFAULT_NAVIGATION: Record<string, NavigationItem[]> = { teacher: teacherNavigation, student: studentNavigation }
export const DEFAULT_WIDGETS: Record<string, DashboardWidgetDefinition[]> = {
  teacher: [
    { key: 'teacher-overview', title: 'Teaching overview', component: 'TeacherDashboard', sortOrder: 10, enabled: true, permission: 'dashboard.view' },
    { key: 'teacher-schedule', title: 'Upcoming schedule', component: 'TeacherScheduleSummary', sortOrder: 20, enabled: true, permission: 'schedule.view' },
    { key: 'teacher-attendance', title: 'Attendance', component: 'TeacherAttendanceSummary', sortOrder: 30, enabled: true, permission: 'attendance.view' },
  ],
  student: [
    { key: 'student-overview', title: 'Learning overview', component: 'StudentDashboard', sortOrder: 10, enabled: true, permission: 'dashboard.view' },
    { key: 'student-next-class', title: 'Next class', component: 'StudentNextClass', sortOrder: 20, enabled: true, permission: 'schedule.view' },
    { key: 'student-progress', title: 'Program progress', component: 'StudentProgress', sortOrder: 30, enabled: true, permission: 'programs.view' },
  ],
}
export const DEFAULT_PERMISSIONS: Record<PlatformRole, PermissionKey[]> = {
  admin: ['admin.manage'],
  teacher: ['dashboard.view','students.view','students.manage','programs.view','programs.manage','schedule.view','schedule.manage','attendance.view','attendance.record','messages.view','subjects.view','profile.view'],
  student: ['dashboard.view','programs.view','schedule.view','messages.view','profile.view'],
}
export function hasPermission(role: string | undefined, permission: PermissionKey): boolean { return !!role && (DEFAULT_PERMISSIONS[role]?.includes(permission) ?? false) }
export function getNavigation(role: string | undefined, flags = DEFAULT_FEATURE_FLAGS): NavigationItem[] { const items=DEFAULT_NAVIGATION[role||'']||[]; return items.filter(item=>item.enabled&&(!item.permission||hasPermission(role,item.permission))&&(!item.featureFlag||flags[item.featureFlag]!==false)) }
