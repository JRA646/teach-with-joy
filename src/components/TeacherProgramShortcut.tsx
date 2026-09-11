import { GraduationCap } from 'lucide-react'

export default function TeacherProgramShortcut() {
  const active = window.location.pathname === '/program'
  return (
    <button
      type="button"
      className={active ? 'teacher-program-shortcut active' : 'teacher-program-shortcut'}
      onClick={() => { window.location.href = '/program' }}
      title="Open Programs & Enrollments"
      aria-current={active ? 'page' : undefined}
    >
      <GraduationCap size={18} />
      <span>Programs</span>
    </button>
  )
}
