import { supabase } from '../lib/supabase'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_NAVIGATION, DEFAULT_WIDGETS, getNavigation } from '../lib/platformConfig'
import type { DashboardWidgetDefinition, NavigationItem, PlatformFeatureFlags } from '../types/platform'

export async function getFeatureFlags(): Promise<PlatformFeatureFlags> {
  const { data, error } = await supabase.from('feature_flags').select('key, enabled')
  if (error || !data) return DEFAULT_FEATURE_FLAGS
  return data.reduce<PlatformFeatureFlags>((flags, row) => {
    flags[row.key] = row.enabled
    return flags
  }, { ...DEFAULT_FEATURE_FLAGS })
}

export async function getNavigationItems(role: string): Promise<NavigationItem[]> {
  const fallback = getNavigation(role)
  const [{ data: items, error: navError }, { data: flags, error: flagError }] = await Promise.all([
    supabase.from('platform_navigation').select('*').eq('role_key', role).eq('enabled', true).order('sort_order'),
    supabase.from('feature_flags').select('key, enabled'),
  ])
  if (navError || !items?.length) return fallback
  const featureFlags = (flags || []).reduce<Record<string, boolean>>((result, row) => { result[row.key] = row.enabled; return result }, { ...DEFAULT_FEATURE_FLAGS })
  return items.filter((item) => !item.feature_flag_key || featureFlags[item.feature_flag_key] !== false).map((item) => ({
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
  const { data, error } = await supabase.from('platform_dashboard_widgets').select('*').eq('role_key', role).eq('enabled', true).order('sort_order')
  if (error || !data?.length) return DEFAULT_WIDGETS[role] || []
  return data.map((widget) => ({
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

export async function recordActivity(action: string, entityType?: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('platform_activity_log').insert({ actor_id: user.id, action, entity_type: entityType, entity_id: entityId || null, metadata })
}
