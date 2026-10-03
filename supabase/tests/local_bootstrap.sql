-- Minimal Supabase schemas for isolated PostgreSQL migration/smoke checks.
create role authenticated;
create role anon;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create schema storage;
create table storage.buckets(
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(value text) returns text[] language sql stable as $$
  select string_to_array(value, '/');
$$;
grant usage on schema auth, storage to authenticated;
grant insert on storage.objects to authenticated;
alter table storage.objects enable row level security;
