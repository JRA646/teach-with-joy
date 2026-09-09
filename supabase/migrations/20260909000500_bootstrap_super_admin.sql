insert into public.admin_users (user_id)
select id
from auth.users
where email = 'super.admin@email.com'
on conflict (user_id) do nothing;
