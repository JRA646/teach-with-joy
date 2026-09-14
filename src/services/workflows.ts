import { supabase } from '../lib/supabase'
import { recordActivity } from './platform'

type WorkflowDefinition = { conditions?: Array<{ field: string; operator: 'equals'|'not_equals'|'contains'|'greater_than'|'less_than'|'exists'; value?: unknown }>; actions?: Array<{ type: 'notify'|'log'; payload?: Record<string, unknown> }> }

function readPath(input: Record<string, unknown>, path: string): unknown { return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, input) }
export function matchesWorkflow(definition: WorkflowDefinition, payload: Record<string, unknown>) {
  return (definition.conditions || []).every(condition => {
    const actual = readPath(payload, condition.field)
    if (condition.operator === 'exists') return actual !== undefined && actual !== null
    if (condition.operator === 'equals') return actual === condition.value
    if (condition.operator === 'not_equals') return actual !== condition.value
    if (condition.operator === 'contains') return String(actual ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase())
    if (condition.operator === 'greater_than') return Number(actual) > Number(condition.value)
    return Number(actual) < Number(condition.value)
  })
}

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
        if (action.type === 'notify') { results.push({ type: action.type, ok: false, skipped: true, reason: 'notification provider not configured' }) }
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
