import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';

export async function getSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function watchSession(onChange: (session: Session | null, event: AuthChangeEvent) => void) {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) =>
    onChange(session, event),
  );
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
}

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { name: name.trim() } },
  });
  if (error) throw error;
  return Boolean(data.session);
}

export async function recoverPassword(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export function consumeAuthCallbackError(): string {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code =
    url.searchParams.get('error_code') ||
    hash.get('error_code') ||
    url.searchParams.get('error') ||
    hash.get('error');
  if (!code) return '';
  for (const key of ['error', 'error_code', 'error_description']) {
    url.searchParams.delete(key);
    hash.delete(key);
  }
  url.hash = hash.toString();
  window.history.replaceState(null, '', url);
  return friendlyAuthError({ code });
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export async function signInWithDiscord() {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export function friendlyAuthError(cause: unknown): string {
  const error = cause as { code?: string; message?: string } | null;
  const detail = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  if (/identity_already_exists|identity_conflict/.test(detail))
    return 'Este Discord já está conectado a outra conta do FocusAcademy.';
  if (/invalid.*credentials|invalid login|email.*password|login credentials/.test(detail))
    return 'E-mail ou senha incorretos.';
  if (/already.*registered|user.*already|email.*exists|already been registered/.test(detail))
    return 'Este e-mail já está cadastrado.';
  if (/email.*not.*confirm|confirm.*email/.test(detail))
    return 'Verifique seu e-mail para continuar.';
  if (/session.*expired|jwt.*expired|refresh_token/.test(detail))
    return 'Sua sessão expirou. Entre novamente.';
  if (/provider|discord|oauth|popup|access_denied|disabled|not enabled/.test(detail))
    return 'Não foi possível conectar ao Discord.';
  if (/network|fetch|connection|timeout/.test(detail))
    return 'Não foi possível conectar agora. Verifique sua conexão e tente novamente.';
  return 'Não foi possível autenticar. Tente novamente.';
}

const discordLinkKey = 'focusedu.discord-link-user';

export function friendlyDiscordError(cause: unknown): string {
  const error = cause as { code?: string; message?: string } | null;
  const detail = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  if (/access_denied|cancel|denied/.test(detail))
    return 'Conexão cancelada. Você pode tentar novamente quando quiser.';
  if (/identity_already_exists|already linked to another|identity_conflict/.test(detail))
    return 'Essa conta Discord já está vinculada a outra conta. Use outro Discord ou acesse a conta original.';
  if (/identity_already_linked|already linked/.test(detail))
    return 'O Discord já está vinculado. Atualize a integração para verificar a conexão.';
  if (/provider|disabled|not enabled|unsupported/.test(detail))
    return 'A integração Discord está indisponível no momento. Tente novamente mais tarde.';
  if (/network|fetch|connection|timeout/.test(detail))
    return 'Não foi possível acessar o Discord. Verifique sua conexão e tente novamente.';
  return 'Não foi possível atualizar a integração Discord. Tente novamente.';
}

export async function linkDiscordIdentity(returnToProfile = false) {
  const client = getSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error('Faça login antes de conectar o Discord.');
  const redirect = new URL(window.location.href);
  redirect.hash = '';
  if (returnToProfile) redirect.searchParams.set('view', 'profile');
  window.sessionStorage.setItem(discordLinkKey, sessionData.session.user.id);
  try {
    if (sessionData.session.expires_at && sessionData.session.expires_at * 1000 <= Date.now()) {
      const { error } = await client.auth.refreshSession();
      if (error) throw error;
    }
    const { error } = await client.auth.linkIdentity({
      provider: 'discord',
      options: { redirectTo: redirect.toString() },
    });
    if (error) throw error;
  } catch (cause) {
    window.sessionStorage.removeItem(discordLinkKey);
    throw cause;
  }
}

export async function finishDiscordIdentityLink(userId: string) {
  const expectedUser = window.sessionStorage.getItem(discordLinkKey);
  if (!expectedUser) return;
  window.sessionStorage.removeItem(discordLinkKey);
  if (expectedUser !== userId) throw new Error('Discord linking session mismatch');
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const callbackError =
    url.searchParams.get('error_code') ||
    hash.get('error_code') ||
    url.searchParams.get('error') ||
    hash.get('error');
  if (callbackError) {
    for (const key of ['error', 'error_code', 'error_description']) {
      url.searchParams.delete(key);
      hash.delete(key);
    }
    url.hash = hash.toString();
    window.history.replaceState(null, '', url);
    throw new Error(callbackError);
  }
  // The SDK restores the OAuth session; refreshing also reloads its user identities.
  const { data, error } = await getSupabase().auth.refreshSession();
  if (error) throw error;
  if (data.session?.user.id !== expectedUser) throw new Error('Discord linking session mismatch');
}

export async function getLinkedIdentities() {
  const { data, error } = await getSupabase().auth.getUserIdentities();
  if (error) throw error;
  return data.identities;
}

export async function unlinkDiscordIdentity() {
  const identities = await getLinkedIdentities();
  const discord = identities.find((identity) => identity.provider === 'discord');
  if (!discord) return;
  if (identities.length < 2) {
    throw new Error('Adicione outra forma de acesso antes de desconectar o Discord.');
  }
  const { error } = await getSupabase().auth.unlinkIdentity(discord);
  if (error) throw error;
}
