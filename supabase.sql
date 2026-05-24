create table if not exists public.date_memory_photos (
  id text primary key,
  album_id text not null,
  name text not null,
  type text,
  sort_time bigint not null,
  width integer,
  height integer,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.date_memory_photos enable row level security;

drop policy if exists "date memory photos read" on public.date_memory_photos;
drop policy if exists "date memory photos insert" on public.date_memory_photos;
drop policy if exists "date memory photos delete" on public.date_memory_photos;

create policy "date memory photos read"
  on public.date_memory_photos
  for select
  to anon
  using (album_id = 'date-memory-main');

create policy "date memory photos insert"
  on public.date_memory_photos
  for insert
  to anon
  with check (album_id = 'date-memory-main');

create policy "date memory photos delete"
  on public.date_memory_photos
  for delete
  to anon
  using (album_id = 'date-memory-main');

-- Supabase dashboardで "date-memory" という private bucket を作ってから実行してください。
drop policy if exists "date memory storage read" on storage.objects;
drop policy if exists "date memory storage insert" on storage.objects;
drop policy if exists "date memory storage delete" on storage.objects;

create policy "date memory storage read"
  on storage.objects
  for select
  to anon
  using (
    bucket_id = 'date-memory'
    and (storage.foldername(name))[1] = 'date-memory-main'
  );

create policy "date memory storage insert"
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'date-memory'
    and (storage.foldername(name))[1] = 'date-memory-main'
  );

create policy "date memory storage delete"
  on storage.objects
  for delete
  to anon
  using (
    bucket_id = 'date-memory'
    and (storage.foldername(name))[1] = 'date-memory-main'
  );
