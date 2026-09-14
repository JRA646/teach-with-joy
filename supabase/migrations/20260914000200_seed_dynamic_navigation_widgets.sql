insert into public.platform_navigation(role_key, item_key, label, path, icon, section, sort_order, permission_key)
values
  ('teacher', 'dashboard', 'Dashboard', '/', 'LayoutDashboard', 'TEACHING', 10, 'dashboard.view'),
  ('teacher', 'programs', 'Students & Programs', '/program', 'GraduationCap', 'TEACHING', 20, 'programs.view'),
  ('teacher', 'proposals', 'Lesson Proposals', '/proposals', 'CalendarClock', 'TEACHING', 30, 'programs.view'),
  ('teacher', 'schedule', 'Schedule', '/schedule', 'CalendarDays', 'TEACHING', 40, 'schedule.view'),
  ('teacher', 'attendance', 'Attendance', '/attendance', 'CalendarCheck', 'TEACHING', 50, 'attendance.view'),
  ('teacher', 'messages', 'Messages', '/messages', 'MessageCircle', 'TEACHING', 60, 'messages.view'),
  ('teacher', 'subjects', 'Subjects', '/subjects', 'BookOpen', 'TEACHING', 70, 'subjects.view'),
  ('teacher', 'profile', 'Profile', '/profile', 'UserRound', 'ACCOUNT', 80, 'profile.view'),
  ('student', 'dashboard', 'Dashboard', '/', 'LayoutDashboard', 'LEARNING', 10, 'dashboard.view'),
  ('student', 'program', 'My Program', '/program', 'GraduationCap', 'LEARNING', 20, 'programs.view'),
  ('student', 'proposals', 'Lesson Proposals', '/proposals', 'CalendarClock', 'LEARNING', 30, 'programs.view'),
  ('student', 'schedule', 'Schedule', '/schedule', 'CalendarDays', 'LEARNING', 40, 'schedule.view'),
  ('student', 'messages', 'Messages', '/messages', 'MessageCircle', 'LEARNING', 50, 'messages.view'),
  ('student', 'profile', 'Profile', '/profile', 'UserRound', 'ACCOUNT', 60, 'profile.view')
on conflict (role_key, item_key) do update set label=excluded.label, path=excluded.path, icon=excluded.icon, section=excluded.section, sort_order=excluded.sort_order, permission_key=excluded.permission_key, enabled=true;

insert into public.platform_dashboard_widgets(role_key, widget_key, title, component, sort_order, permission_key)
values
  ('teacher', 'teacher-overview', 'Teaching overview', 'TeacherDashboard', 10, 'dashboard.view'),
  ('teacher', 'teacher-schedule', 'Upcoming schedule', 'TeacherScheduleSummary', 20, 'schedule.view'),
  ('teacher', 'teacher-attendance', 'Attendance', 'TeacherAttendanceSummary', 30, 'attendance.view'),
  ('student', 'student-overview', 'Learning overview', 'StudentDashboard', 10, 'dashboard.view'),
  ('student', 'student-next-class', 'Next class', 'StudentNextClass', 20, 'schedule.view'),
  ('student', 'student-progress', 'Program progress', 'StudentProgress', 30, 'programs.view')
on conflict (role_key, widget_key) do update set title=excluded.title, component=excluded.component, sort_order=excluded.sort_order, permission_key=excluded.permission_key, enabled=true;
