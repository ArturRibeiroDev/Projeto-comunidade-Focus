-- Keep existing bios intact; validate when the database has no legacy rows over 600.
alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (length(bio) <= 600) not valid;

do $$
begin
  if not exists (select 1 from public.profiles where length(bio) > 600) then
    alter table public.profiles validate constraint profiles_bio_check;
  end if;
end;
$$;
