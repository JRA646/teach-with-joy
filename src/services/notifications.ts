import { supabase } from '../lib/supabase'

type Channel = 'in_app'|'email'|'push'|'sms'
export async function getNotificationPreferences(userId: string, organizationId?: string | null) {
  const { data } = await supabase.from('platform_notification_preferences').select('channel,enabled').eq('user_id', userId).is('organization_id', organizationId ?? null)
  return (data || []).reduce<Record<string, boolean>>((result, row) => { result[row.channel] = row.enabled; return result }, { in_app: true, email: true, push: true, sms: false })
}
export async function setNotificationPreference(userId: string, channel: Channel, enabled: boolean, organizationId?: string | null) {
  return supabase.from('platform_notification_preferences').upsert({ user_id: userId, organization_id: organizationId ?? null, channel, enabled, updated_at: new Date().toISOString() }, { onConflict: 'user_id,organization_id,channel' })
}
export async function listNotificationTemplates(organizationId?: string | null) {
  const query = supabase.from('platform_notification_templates').select('*').order('template_key')
  return organizationId ? query.eq('organization_id', organizationId) : query.is('organization_id', null)
}
