import { supabase } from '../lib/supabase'
import { recordActivity } from './platform'

export async function saveConfigurationVersion(
  configType: string,
  snapshot: unknown,
  organizationId?: string | null,
) {
  let latestQuery = supabase
    .from('platform_configuration_versions')
    .select('version')
    .eq('config_type', configType)

  if (organizationId) {
    latestQuery = latestQuery.eq('organization_id', organizationId)
  } else {
    latestQuery = latestQuery.is('organization_id', null)
  }

  const { data: latest, error: latestError } = await latestQuery
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) return { data: null, error: latestError }

  const version = Number(latest?.version ?? 0) + 1
  const user = (await supabase.auth.getUser()).data.user

  const result = await supabase
    .from('platform_configuration_versions')
    .insert({
      organization_id: organizationId ?? null,
      config_type: configType,
      version,
      status: 'draft',
      snapshot,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (!result.error) {
    await recordActivity(
      'platform.configuration.version_created',
      'configuration',
      result.data?.id,
      { configType, version },
    )
  }

  return result
}

export async function publishConfigurationVersion(id: string) {
  const user = (await supabase.auth.getUser()).data.user
  const current = await supabase
    .from('platform_configuration_versions')
    .select('config_type,organization_id,version')
    .eq('id', id)
    .single()

  if (current.error) return current

  let archiveQuery = supabase
    .from('platform_configuration_versions')
    .update({ status: 'archived' })
    .eq('config_type', current.data.config_type)
    .eq('status', 'published')

  if (current.data.organization_id) {
    archiveQuery = archiveQuery.eq(
      'organization_id',
      current.data.organization_id,
    )
  } else {
    archiveQuery = archiveQuery.is('organization_id', null)
  }

  const archive = await archiveQuery
  if (archive.error) return { data: null, error: archive.error }

  const result = await supabase
    .from('platform_configuration_versions')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (!result.error) {
    await recordActivity(
      'platform.configuration.published',
      'configuration',
      id,
      {
        configType: current.data.config_type,
        version: current.data.version,
      },
    )
  }

  return result
}
