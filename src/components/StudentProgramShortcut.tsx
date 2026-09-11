import { GraduationCap } from 'lucide-react'

export default function StudentProgramShortcut() {
  return (
    <button
      type="button"
      className="teacher-program-shortcut"
      onClick={() => { window.location.href = '/program' }}
      title="Open My Program"
    >
      <GraduationCap size={18} />
      <span>My Program</span>
    </button>
  )
}
