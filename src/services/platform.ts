import { supabase } from '../lib/supabase'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_WIDGETS, getNavigation } from '../lib/platformConfig'
import type { DashboardWidgetDefinition, NavigationItem, PermissionKey, PlatformFeatureFlags, PlatformRole } from '../types/platform'

export async function getFeatureFlags(role?: string): Promise<PlatformFeatureFlags> {
  const { data, error } = await supabase.from('feature_flags').select('key, enabled, enabled_roles, starts_at, ends_at')
  if (error || !data) return { ...DEFAULT_FEATURE_FLAGS }
  const now = Date.now()
  return data.reduce<PlatformFeatureFlags>((flags, row) => {
    const starts = row.starts_at ? new Date(row.starts_at).getTime() : null
    const ends = row.ends_at ? new Date(row.ends_at).getTime() : null
    flags[row.key] = Boolean(row.enabled && (!starts || now >= starts) && (!ends || now <= ends) && (!row.enabled_roles?.length || !role || row.enabled_roles.includes(role)))
    return flags
  }, { ...DEFAULT_FEATURE_FLAGS })
}

export async function getNavigationItems(role: string): Promise<NavigationItem[]> {
  const fallback = getNavigation(role)
  const [{ data: items, error }, flags] = await Promise.all([
    supabase.from('platform_navigation').select('*').eq('role_key', role).eq('enabled', true).order('sort_order'),
    getFeatureFlags(role),
  ])
  if (error || !items?.length) return fallback
  return items.filter(item => !item.feature_flag_key || flags[item.feature_flag_key] !== false).map(item => ({
    key: item.item_key, label: item.label, path: item.path, icon: item.icon || undefined, section: item.section || undefined,
    sortOrder: item.sort_order, permission: item.permission_key || undefined, featureFlag: item.feature_flag_key || undefined,
    enabled: item.enabled, metadata: item.metadata || {},
  }))
}

export async function getDashboardWidgets(role: string): Promise<DashboardWidgetDefinition[]> {
  const [result, flags] = await Promise.all([
    supabase.from('platform_dashboard_widgets').select('*').eq('role_key', role).eq('enabled', true).order('sort_order'),
    getFeatureFlags(role),
  ])
  if (result.error || !result.data?.length) return DEFAULT_WIDGETS[role] || []
  return result.data.filter(widget => !widget.feature_flag_key || flags[widget.feature_flag_key] !== false).map(widget => ({
    key: widget.widget_key, title: widget.title, component: widget.component, sortOrder: widget.sort_order, enabled: widget.enabled,
    permission: widget.permission_key || undefined, featureFlag: widget.feature_flag_key || undefined, config: widget.config || {},
  }))
}

export async function getCurrentRoles(): Promise<PlatformRole[]> {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) return []
  const { data } = await supabase.from('platform_user_roles').select('role:platform_roles(role_key)').eq('user_id', userId)
  return (data || []).map((row: any) => row.role?.role_key).filter(Boolean) as PlatformRole[]
}

export async function getPermissions(role?: string): Promise<PermissionKey[]> {
  if (!role) return []
  const { data } = await supabase.from('platform_role_permissions').select('permission:platform_permissions(permission_key), role:platform_roles!inner(role_key)').eq('role.role_key', role)
  return (data || []).map((row: any) => row.permission?.permission_key).filter(Boolean) as PermissionKey[]
}

export async function hasPermission(permission: PermissionKey, role?: string, known?: PermissionKey[]): Promise<boolean> {
  if (role === 'admin') return true
  return (known || await getPermissions(role)).includes(permission)
}

export async function recordActivity(action: string, entityType?: string, entityId?: string, metadata: Record<string, unknown> = {}, beforeData?: unknown, afterData?: unknown) {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) return
  await supabase.from('platform_activity_log').insert({ actor_id: user.id, action, entity_type: entityType, entity_id: entityId || null, metadata, before_data: beforeData || null, after_data: afterData || null })
}

export async function saveFeatureFlag(key: string, enabled: boolean, options: { description?: string; rolloutPercentage?: number; roles?: string[]; startsAt?: string | null; endsAt?: string | null } = {}) {
  const user = (await supabase.auth.getUser()).data.user
  const result = await supabase.from('feature_flags').upsert({ key, enabled, description: options.description, rollout_percentage: options.rolloutPercentage ?? 100, enabled_roles: options.roles ?? [], starts_at: options.startsAt ?? null, ends_at: options.endsAt ?? null, updated_by: user?.id || null, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (!result.error) await recordActivity('platform.feature_flag.updated', 'feature_flag', undefined, { key, enabled })
  return result
}

export async function upsertNavigation(item: Partial<NavigationItem> & { role_key?: string; item_key?: string }) {
  return supabase.from('platform_navigation').upsert({
    role_key: item.role_key || 'teacher', item_key: item.item_key || item.key || crypto.randomUUID(), label: item.label || 'New item', path: item.path || '/',
    icon: item.icon || null, section: item.section || null, sort_order: item.sortOrder ?? 0, permission_key: item.permission || null,
    feature_flag_key: item.featureFlag || null, enabled: item.enabled !== false, metadata: item.metadata || {}, updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,role_key,item_key' })
}

export async function upsertDashboardWidget(widget: Partial<DashboardWidgetDefinition> & { role_key?: string; widget_key?: string }) {
  return supabase.from('platform_dashboard_widgets').upsert({
    role_key: widget.role_key || 'teacher', widget_key: widget.widget_key || widget.key || crypto.randomUUID(), title: widget.title || 'Widget',
    component: widget.component || 'PlaceholderWidget', sort_order: widget.sortOrder ?? 0, enabled: widget.enabled !== false,
    permission_key: widget.permission || null, feature_flag_key: widget.featureFlag || null, config: widget.config || {}, updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,role_key,widget_key' })
}

export async function searchPlatform(query: string, limit = 20) {
  if (!query.trim()) return []
  const { data } = await supabase.from('platform_search_index').select('entity_type,entity_id,title,subtitle,metadata').ilike('search_text', `%${query.trim()}%`).limit(limit)
  return data || []
}
