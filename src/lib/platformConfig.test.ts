import { describe, expect, it } from 'vitest'
import { DEFAULT_FEATURE_FLAGS, getNavigation, hasPermission } from './platformConfig'

describe('platform configuration', () => {
  it('provides the core feature flags', () => {
    expect(DEFAULT_FEATURE_FLAGS['platform.dynamic_navigation']).toBe(true)
    expect(DEFAULT_FEATURE_FLAGS['platform.form_builder']).toBe(false)
  })

  it('filters navigation by role permissions', () => {
    expect(getNavigation('teacher').map((item) => item.key)).toContain('attendance')
    expect(getNavigation('student').map((item) => item.key)).not.toContain('attendance')
  })

  it('checks role permissions', () => {
    expect(hasPermission('teacher', 'attendance.record')).toBe(true)
    expect(hasPermission('student', 'attendance.record')).toBe(false)
  })
})
