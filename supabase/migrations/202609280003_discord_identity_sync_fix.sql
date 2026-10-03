create or replace function private.sync_discord_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare discord_id text;
begin
  if tg_op = 'DELETE' then
    if old.provider = 'discord' then
      delete from public.user_integrations where user_id = old.user_id and provider = 'discord';
    end if;
    return old;
  end if;
  if new.provider <> 'discord' then return new; end if;
  discord_id := coalesce(nullif(new.identity_data->>'sub', ''), nullif(new.provider_id, ''));
  if discord_id !~ '^[0-9]{17,22}$' then
    raise exception 'Identidade Discord inválida';
  end if;
  insert into public.user_integrations
    (user_id, provider, provider_user_id, provider_username, provider_avatar)
  values (new.user_id, 'discord', discord_id,
    left(coalesce(new.identity_data->>'username', new.identity_data->>'name'), 120),
    left(new.identity_data->>'avatar_url', 500))
  on conflict (user_id, provider) do update set
    provider_user_id = excluded.provider_user_id,
    provider_username = excluded.provider_username,
    provider_avatar = excluded.provider_avatar,
    updated_at = now();
  return new;
end;
$$;

insert into public.user_integrations
  (user_id, provider, provider_user_id, provider_username, provider_avatar)
select user_id, 'discord', discord_id,
  left(coalesce(identity_data->>'username', identity_data->>'name'), 120),
  left(identity_data->>'avatar_url', 500)
from (
  select user_id, identity_data,
    coalesce(nullif(identity_data->>'sub', ''), nullif(provider_id, '')) as discord_id
  from auth.identities
  where provider = 'discord'
) identities
where discord_id ~ '^[0-9]{17,22}$'
on conflict (user_id, provider) do update set
  provider_user_id = excluded.provider_user_id,
  provider_username = excluded.provider_username,
  provider_avatar = excluded.provider_avatar,
  updated_at = now();
