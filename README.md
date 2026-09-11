# TeachWithJoy

TeachWithJoy is a React + TypeScript tutoring platform backed by Supabase. The production workflow is enrollment- and program-based rather than lesson-by-lesson booking.

## Product model

- Monthly enrollment: 20 sessions.
- Three-month enrollment: 60 sessions, 3 postponement privileges, and 2 free e-books.
- Philippine and Korean holidays do not consume program sessions.
- Student absence consumes a session and has no make-up.
- Teacher absence, teacher cancellation, eligible postponement, and holidays create replacement sessions.
- A lesson becomes completed only when a teacher explicitly records attendance.
- Sessions can use Teach With Joy video, Zoom, Microsoft Teams, Google Meet, or another meeting provider.

## Teacher workspace

The teacher account uses one shared application shell with:

- Dashboard
- Students & Programs
- Schedule
- Attendance
- Messages
- Subjects
- Profile

Programs are built around `enrollments -> sessions -> attendance` with preferred schedules, teacher-specific recurring availability, holiday-aware schedule generation, make-ups, audit history, and payment records.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

GitHub Actions runs typecheck, unit tests, and the production build on pushes and pull requests to `main`.

## Supabase

Program migrations live under `supabase/migrations` and cover enrollments, sessions, preferred schedules, holidays, payments, e-book entitlements, attendance auditing, scheduling automation, and session accounting hardening.
