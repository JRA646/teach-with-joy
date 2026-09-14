export type PlatformRole = 'admin' | 'teacher' | 'student' | (string & {})

export type PermissionKey =
  | 'dashboard.view'
  | 'students.view'
  | 'students.manage'
  | 'programs.view'
  | 'programs.manage'
  | 'schedule.view'
  | 'schedule.manage'
  | 'attendance.view'
  | 'attendance.record'
  | 'messages.view'
  | 'subjects.view'
  | 'profile.view'
  | 'admin.manage'
  | (string & {})

export interface PlatformFeatureFlags {
  'platform.dynamic_navigation': boolean
  'platform.dashboard_widgets': boolean
  'platform.activity_log': boolean
  'platform.form_builder': boolean
  'platform.workflow_engine': boolean
  [key: string]: boolean
}

export interface NavigationItem {
  key: string
  label: string
  path: string
  icon?: string
  section?: string
  sortOrder: number
  permission?: PermissionKey
  featureFlag?: string
  enabled: boolean
  metadata?: Record<string, unknown>
}

export interface DashboardWidgetDefinition {
  key: string
  title: string
  component: string
  sortOrder: number
  enabled: boolean
  permission?: PermissionKey
  featureFlag?: string
  config?: Record<string, unknown>
}

export interface SessionLifecycle {
  scheduled: string[]
  terminal: string[]
}
