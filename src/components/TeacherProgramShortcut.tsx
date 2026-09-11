import { GraduationCap } from 'lucide-react'

export default function TeacherProgramShortcut() {
  return (
    <button
      type="button"
      className="teacher-program-shortcut"
      onClick={() => { window.location.href = '/program' }}
      title="Open Programs & Enrollments"
    >
      <GraduationCap size={18} />
      <span>Programs</span>
    </button>
  )
}
