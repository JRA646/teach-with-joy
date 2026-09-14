import { supabase } from '../lib/supabase'
import { recordActivity } from './platform'

export async function saveConfigurationVersion(configType: string, snapshot: unknown, organizationId?: string | null) {
  const { data: latest } = await supabase.from('platform_configuration_versions').select('version').eq('config_type', configType).is('organization_id', organizationId ?? null).order('version',{ascending:false}).limit(1).maybeSingle()
  const version = Number(latest?.version || 0) + 1
  const user = (await supabase.auth.getUser()).data.user
  const result = await supabase.from('platform_configuration_versions').insert({ organization_id: organizationId ?? null, config_type: configType, version, status: 'draft', snapshot, created_by: user?.id || null }).select().single()
  if (!result.error) await recordActivity('platform.configuration.version_created','configuration',result.data?.id,{configType,version})
  return result
}

export async function publishConfigurationVersion(id: string) {
  const user = (await supabase.auth.getUser()).data.user
  const current = await supabase.from('platform_configuration_versions').select('config_type,organization_id,version').eq('id',id).single()
  if (current.error) return current
  await supabase.from('platform_configuration_versions').update({status:'archived'}).eq('config_type',current.data.config_type).eq('organization_id',current.data.organization_id).eq('status','published')
  const result = await supabase.from('platform_configuration_versions').update({status:'published',published_at:new Date().toISOString(),created_by:user?.id||null}).eq('id',id).select().single()
  if (!result.error) await recordActivity('platform.configuration.published','configuration',id,{configType:current.data.config_type,version:current.data.version})
  return result
}
