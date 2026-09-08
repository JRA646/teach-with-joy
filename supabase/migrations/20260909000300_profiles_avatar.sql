-- Profile photos and secure avatar storage.
alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Public read is intentional: avatars are profile images shown to signed-in users.
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
create policy "Avatar images are publicly accessible."
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- Each authenticated user can upload only inside their own profile folder.
drop policy if exists "Users can upload their own avatar." on storage.objects;
create policy "Users can upload their own avatar."
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Users can replace/delete only files in their own profile folder.
drop policy if exists "Users can update their own avatar." on storage.objects;
create policy "Users can update their own avatar."
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete their own avatar." on storage.objects;
create policy "Users can delete their own avatar."
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Profile records are readable so teachers/students can see the other party's profile.
-- Keep updates restricted to the signed-in owner.
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone."
on public.profiles for select
to public
using (true);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile."
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
