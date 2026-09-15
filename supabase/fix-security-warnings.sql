-- Fix Security Advisor Warnings
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- =============================================
-- FIX 1: handle_new_user() — lock search_path
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    '#' || lpad(to_hex((random() * 16777215)::int), 6, '0')
  );
  return new;
end;
$$ language plpgsql
   security definer
   set search_path = public, pg_temp;

-- Restrict who can call handle_new_user() directly
-- (The trigger still fires automatically — this just blocks manual calls)
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to supabase_admin;

-- =============================================
-- FIX 2: rls_auto_enable() — lock search_path
-- =============================================
-- Check if this function exists (it may be a Supabase system function)
-- If it exists in your schema, apply the same fix:
-- create or replace function public.rls_auto_enable()
-- returns trigger as $$
-- begin
--   ... existing body ...
-- end;
-- $$ language plpgsql
--    security definer
--    set search_path = public, pg_temp;
--
-- revoke execute on function public.rls_auto_enable() from public;
-- revoke execute on function public.rls_auto_enable() from authenticated;
-- grant execute on function public.rls_auto_enable() to supabase_admin;

-- =============================================
-- Verify: list SECURITY DEFINER functions without search_path
-- =============================================
-- Run this to confirm no more warnings:
-- select p.proname, p.prosecdef,
--        coalesce(proconfig::text, 'NOT SET') as search_path
-- from pg_proc p
-- left join pg_language l on p.prolang = l.oid
-- where p.prosecdef = true
--   and l.lanname = 'plpgsql'
--   and p.pronamespace = 'public'::regnamespace;
