update public.site_content
set content = content || jsonb_build_object(
  'features', coalesce(content->'features', '[{"title":"1-on-1 Lessons","text":"Personalized for you","icon":"users"},{"title":"Flexible Schedule","text":"Book around your day","icon":"calendar"},{"title":"Secure Access","text":"Your account stays protected","icon":"shield"},{"title":"Progress Focused","text":"Learn with purpose","icon":"sparkles"}]'::jsonb),
  'infoCards', coalesce(content->'infoCards', '[{"title":"Meaningful lessons","text":"Build skills with focused, teacher-led sessions.","icon":"book"},{"title":"Real availability","text":"See bookable teacher slots before you commit.","icon":"calendar"},{"title":"Human support","text":"Ask questions and stay connected when it matters.","icon":"message"},{"title":"A joyful rhythm","text":"Make learning easier to return to week after week.","icon":"sparkles"}]'::jsonb)
where page = 'home';

update public.site_content
set content = content || jsonb_build_object(
  'cards', coalesce(content->'cards', '[{"title":"Teacher first","text":"Give teachers a clean workspace to manage availability, subjects, and upcoming sessions.","icon":"graduation"},{"title":"Student centered","text":"Help students make confident choices about subjects, times, and lesson goals.","icon":"users"},{"title":"Trusted experience","text":"Keep sign-in and account access connected to secure Supabase authentication.","icon":"shield"}]'::jsonb)
where page = 'about';

update public.site_content
set content = content || jsonb_build_object(
  'steps', coalesce(content->'steps', '[{"title":"Choose a subject","text":"Find the lesson that matches your goal."},{"title":"Pick an open slot","text":"Book from teacher availability."},{"title":"Attend and learn","text":"Keep everything together in your workspace."}]'::jsonb)
where page = 'schedule';

update public.site_content
set content = content || jsonb_build_object(
  'plans', coalesce(content->'plans', '[{"name":"Starter","price":"$19","detail":"per lesson","items":["1 focused lesson","Teacher availability","Secure account"]},{"name":"Growth","price":"$69","detail":"per month","featured":true,"items":["4 lessons per month","Flexible scheduling","Priority booking","Progress-friendly routine"]},{"name":"Flexible","price":"$99","detail":"custom","items":["Custom lesson bundle","Multiple subjects","Schedule around you","Best for changing needs"]}]'::jsonb)
where page = 'pricing';

update public.site_content
set content = content || jsonb_build_object(
  'formTitle', coalesce(content->>'formTitle', 'Tell us what you need.'),
  'contactIntro', coalesce(content->>'contactIntro', 'Use the form to send a message and our team will help with your next step.')
)
where page = 'contact';
