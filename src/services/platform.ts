import { supabase } from '../lib/supabase'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_WIDGETS, getNavigation } from '../lib/platformConfig'
import type { DashboardWidgetDefinition, NavigationItem, PermissionKey, PlatformFeatureFlags, PlatformRole } from '../types/platform'

let featureFlagCache: { value: PlatformFeatureFlags; expiresAt: number } | null = null
const CONFIG_TTL_MS = 60_000

export function clearPlatformConfigCache() { featureFlagCache = null }

export async function getFeatureFlags(_role?: string): Promise<PlatformFeatureFlags> {
  if (featureFlagCache && featureFlagCache.expiresAt > Date.now()) return featureFlagCache.value
  const { data, error } = await supabase.from('feature_flags').select('key, enabled')
  if (error) throw new Error(`Unable to load feature flags: ${error.message}`)
  const value = (data || []).reduce<PlatformFeatureFlags>((flags, row) => { flags[row.key] = Boolean(row.enabled); return flags }, { ...DEFAULT_FEATURE_FLAGS })
  featureFlagCache = { value, expiresAt: Date.now() + CONFIG_TTL_MS }
  return value
}

export async function getNavigationItems(role: string): Promise<NavigationItem[]> {
  const fallback = getNavigation(role)
  const [navigationResult, flags, permissions] = await Promise.all([
    supabase.from('platform_navigation').select('*').eq('role_key', role).eq('enabled', true).order('sort_order'),
    getFeatureFlags(role),
    getPermissions(role),
  ])
  if (navigationResult.error) throw new Error(`Unable to load ${role} navigation: ${navigationResult.error.message}`)
  if (!navigationResult.data?.length) return fallback
  const permissionSet = new Set(permissions)
  return navigationResult.data.filter(item => (!item.permission_key || permissionSet.has(item.permission_key)) && (!item.feature_flag_key || flags[item.feature_flag_key] !== false)).map(item => ({
    key: item.item_key,
    label: item.label,
    path: item.path,
    icon: item.icon || undefined,
    section: item.section || undefined,
    sortOrder: item.sort_order,
    permission: item.permission_key || undefined,
    featureFlag: item.feature_flag_key || undefined,
    enabled: item.enabled,
    metadata: item.metadata || {},
  }))
}

export async function getDashboardWidgets(role: string): Promise<DashboardWidgetDefinition[]> {
  const [result, flags, permissions] = await Promise.all([
    supabase.from('platform_dashboard_widgets').select('*').eq('role_key', role).eq('enabled', true).order('sort_order'),
    getFeatureFlags(role),
    getPermissions(role),
  ])
  if (result.error) throw new Error(`Unable to load ${role} dashboard widgets: ${result.error.message}`)
  if (!result.data?.length) return DEFAULT_WIDGETS[role] || []
  const permissionSet = new Set(permissions)
  return result.data.filter(widget => (!widget.permission_key || permissionSet.has(widget.permission_key)) && (!widget.feature_flag_key || flags[widget.feature_flag_key] !== false)).map(widget => ({
    key: widget.widget_key,
    title: widget.title,
    component: widget.component,
    sortOrder: widget.sort_order,
    enabled: widget.enabled,
    permission: widget.permission_key || undefined,
    featureFlag: widget.feature_flag_key || undefined,
    config: widget.config || {},
  }))
}

export async function getCurrentRoles(): Promise<PlatformRole[]> {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) return []
  const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (error) throw new Error(`Unable to load current role: ${error.message}`)
  return data?.role ? [data.role as PlatformRole] : []
}

export async function getPermissions(role?: string): Promise<PermissionKey[]> {
  if (!role) return []
  const { data, error } = await supabase.from('platform_role_permissions').select('permission_key').eq('role_key', role)
  if (error) throw new Error(`Unable to load permissions for ${role}: ${error.message}`)
  return (data || []).map(row => row.permission_key as PermissionKey)
}

export async function hasPermission(permission: PermissionKey, role?: string, known?: PermissionKey[]): Promise<boolean> {
  if (role === 'admin') return true
  return (known || await getPermissions(role)).includes(permission)
}

export async function recordActivity(action: string, entityType?: string, entityId?: string, metadata: Record<string, unknown> = {}, beforeData?: unknown, afterData?: unknown) {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) return
  const result = await supabase.from('platform_activity_log').insert({
    actor_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    metadata,
    before_data: beforeData ?? null,
    after_data: afterData ?? null,
  })
  if (result.error) console.error('Failed to record platform activity:', result.error)
}

export async function saveFeatureFlag(key: string, enabled: boolean, options: { description?: string } = {}) {
  const user = (await supabase.auth.getUser()).data.user
  const result = await supabase.from('feature_flags').upsert({ key, enabled, description: options.description, updated_by: user?.id || null, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (!result.error) { clearPlatformConfigCache(); await recordActivity('platform.feature_flag.updated', 'feature_flag', undefined, { key, enabled }) }
  return result
}

export async function upsertNavigation(item: Partial<NavigationItem> & { role_key?: string; item_key?: string }) {
  const result = await supabase.from('platform_navigation').upsert({ role_key: item.role_key || 'teacher', item_key: item.item_key || item.key || crypto.randomUUID(), label: item.label || 'New item', path: item.path || '/', icon: item.icon || null, section: item.section || null, sort_order: item.sortOrder ?? 0, permission_key: item.permission || null, feature_flag_key: item.featureFlag || null, enabled: item.enabled !== false, metadata: item.metadata || {} }, { onConflict: 'role_key,item_key' })
  if (!result.error) await recordActivity('platform.navigation.updated', 'navigation', undefined, { role: item.role_key || 'teacher', item_key: item.item_key || item.key })
  return result
}

export async function upsertDashboardWidget(widget: Partial<DashboardWidgetDefinition> & { role_key?: string; widget_key?: string }) {
  const result = await supabase.from('platform_dashboard_widgets').upsert({ role_key: widget.role_key || 'teacher', widget_key: widget.widget_key || widget.key || crypto.randomUUID(), title: widget.title || 'Widget', component: widget.component || 'PlaceholderWidget', sort_order: widget.sortOrder ?? 0, enabled: widget.enabled !== false, permission_key: widget.permission || null, feature_flag_key: widget.featureFlag || null, config: widget.config || {} }, { onConflict: 'role_key,widget_key' })
  if (!result.error) await recordActivity('platform.dashboard_widget.updated', 'dashboard_widget', undefined, { role: widget.role_key || 'teacher', widget_key: widget.widget_key || widget.key })
  return result
}

export async function searchPlatform(query: string, limit = 20) {
  if (!query.trim()) return []
  const { data, error } = await supabase.from('platform_search_index').select('entity_type,entity_id,title,subtitle,metadata').ilike('search_text', `%${query.trim()}%`).limit(limit)
  if (error) throw new Error(`Platform search failed: ${error.message}`)
  return data || []
}
