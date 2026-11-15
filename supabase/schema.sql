-- PV Servicios · esquema de base de datos para Supabase
-- Pegar completo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.

-- ───────────────────────── Perfiles y roles ─────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- Cada usuario nuevo parte como 'viewer' (sin permisos). El rol admin se asigna
-- a mano desde el SQL Editor; nadie puede cambiarse el rol desde la web.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios creados antes de ejecutar este script
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ───────────────────────── Trabajos y fotos ─────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  category    text not null default 'hogar'
              check (category in ('hogar', 'carros', 'carpinteria', 'otros')),
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.project_images (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  url          text not null,   -- URL pública, o ruta relativa del sitio (images/…)
  storage_path text,            -- ruta dentro del bucket 'fotos' (null si es del sitio)
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists project_images_project_idx
  on public.project_images (project_id, position);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ───────────────────────── Permisos (RLS) ─────────────────────────
alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.project_images enable row level security;

revoke all on public.profiles, public.projects, public.project_images from anon, authenticated;
grant select on public.projects, public.project_images to anon, authenticated;
grant insert, update, delete on public.projects, public.project_images to authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "perfil propio o admin" on public.profiles;
create policy "perfil propio o admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "publicados visibles para todos" on public.projects;
create policy "publicados visibles para todos" on public.projects
  for select to anon, authenticated
  using (published or public.is_admin());

drop policy if exists "admin crea trabajos" on public.projects;
create policy "admin crea trabajos" on public.projects
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin edita trabajos" on public.projects;
create policy "admin edita trabajos" on public.projects
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin borra trabajos" on public.projects;
create policy "admin borra trabajos" on public.projects
  for delete to authenticated using (public.is_admin());

drop policy if exists "fotos de trabajos publicados" on public.project_images;
create policy "fotos de trabajos publicados" on public.project_images
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = project_id and p.published)
  );

drop policy if exists "admin agrega fotos" on public.project_images;
create policy "admin agrega fotos" on public.project_images
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin edita fotos" on public.project_images;
create policy "admin edita fotos" on public.project_images
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin borra fotos" on public.project_images;
create policy "admin borra fotos" on public.project_images
  for delete to authenticated using (public.is_admin());

-- ───────────────────────── Almacenamiento de fotos ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: admin ve" on storage.objects;
create policy "fotos: admin ve" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and public.is_admin());

drop policy if exists "fotos: admin sube" on storage.objects;
create policy "fotos: admin sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_admin());

drop policy if exists "fotos: admin reemplaza" on storage.objects;
create policy "fotos: admin reemplaza" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and public.is_admin())
  with check (bucket_id = 'fotos' and public.is_admin());

drop policy if exists "fotos: admin borra" on storage.objects;
create policy "fotos: admin borra" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
