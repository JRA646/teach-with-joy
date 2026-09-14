import { supabase } from '../lib/supabase'
import { matchesConditions, type WorkflowCondition } from '../lib/workflowRules'
import { recordActivity } from './platform'

type WorkflowDefinition = { conditions?: WorkflowCondition[]; actions?: Array<{ type: 'notify'|'log'; payload?: Record<string, unknown> }> }
export const matchesWorkflow = (definition: WorkflowDefinition, payload: Record<string, unknown>) => matchesConditions(definition.conditions || [], payload)

export async function triggerWorkflows(triggerType: string, payload: Record<string, unknown>) {
  const { data: workflows } = await supabase.from('platform_workflows').select('*').eq('trigger_type', triggerType).eq('enabled', true)
  const runs: any[] = []
  for (const workflow of workflows || []) {
    const definition = (workflow.definition || {}) as WorkflowDefinition
    if (!matchesWorkflow(definition, payload)) continue
    const { data: run } = await supabase.from('platform_workflow_runs').insert({ workflow_id: workflow.id, status: 'running', trigger_payload: payload, started_at: new Date().toISOString() }).select().single()
    if (!run) continue
    try {
      const results: unknown[] = []
      for (const action of definition.actions || []) {
        if (action.type === 'log') { await recordActivity('workflow.action.log', 'workflow', workflow.id, action.payload || {}); results.push({ type: action.type, ok: true }) }
        if (action.type === 'notify') results.push({ type: action.type, ok: false, skipped: true, reason: 'notification provider not configured' })
      }
      await supabase.from('platform_workflow_runs').update({ status: 'completed', result: { actions: results }, completed_at: new Date().toISOString() }).eq('id', run.id)
      runs.push({ ...run, status: 'completed' })
    } catch (error) {
      await supabase.from('platform_workflow_runs').update({ status: 'failed', error: error instanceof Error ? error.message : String(error), completed_at: new Date().toISOString() }).eq('id', run.id)
      runs.push({ ...run, status: 'failed' })
    }
  }
  return runs
}
