import { useCallback, useEffect, useRef, useState } from 'react';
import {
  finishDiscordIdentityLink,
  friendlyDiscordError,
  getLinkedIdentities,
  linkDiscordIdentity,
  unlinkDiscordIdentity,
} from './authService';
import { getOwnDiscordIntegration } from './discordService';

export type DiscordConnection = {
  status: 'loading' | 'connected' | 'disconnected' | 'error';
  connected: boolean;
  username: string | null;
  identityCount: number;
  loading: boolean;
  pending: boolean;
  error: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  retry: () => Promise<void>;
};

export function useDiscordIntegration(
  userId: string | undefined,
  authRevision: number,
  returnToProfile: boolean,
): DiscordConnection {
  const [state, setState] = useState({
    status: 'loading' as DiscordConnection['status'],
    connected: false,
    username: null as string | null,
    identityCount: 0,
    loading: true,
    pending: false,
    error: '',
  });
  const generation = useRef(0);
  const inFlight = useRef(false);
  const callback = useRef<{ userId: string; result: Promise<void> }>(undefined);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!userId) {
      setState({
        status: 'disconnected',
        connected: false,
        username: null,
        identityCount: 0,
        loading: false,
        pending: false,
        error: '',
      });
      return;
    }
    setState((previous) => ({ ...previous, status: 'loading', loading: true, error: '' }));
    let callbackError = '';
    try {
      if (callback.current?.userId !== userId)
        callback.current = { userId, result: finishDiscordIdentityLink(userId) };
      await callback.current.result;
    } catch (cause) {
      callbackError = friendlyDiscordError(cause);
    }
    try {
      const identities = await getLinkedIdentities();
      // auth.identities' existing trigger synchronizes user_integrations server-side.
      const integration = await getOwnDiscordIntegration(userId);
      if (current !== generation.current) return;
      const username = integration?.provider_username?.replace(/^@/, '').trim();
      setState((previous) => ({
        ...previous,
        status: integration ? 'connected' : 'disconnected',
        connected: Boolean(integration),
        username: username && !/^\d{17,22}$/.test(username) ? username : null,
        identityCount: identities.length,
        loading: false,
        pending: integration || callbackError ? false : previous.pending,
        error: callbackError,
      }));
    } catch (cause) {
      if (current === generation.current)
        setState((previous) => ({
          ...previous,
          status: 'error',
          loading: false,
          error: callbackError || friendlyDiscordError(cause),
        }));
    }
  }, [userId]);

  useEffect(() => {
    void reload();
    return () => {
      generation.current += 1;
    };
  }, [reload, authRevision]);

  const run = async (action: () => Promise<void>, redirects = false) => {
    if (inFlight.current || !userId) return;
    inFlight.current = true;
    callback.current = undefined;
    setState((previous) => ({ ...previous, pending: true, error: '' }));
    try {
      await action();
      if (!redirects) await reload();
    } catch (cause) {
      await reload();
      setState((previous) => ({ ...previous, pending: false, error: friendlyDiscordError(cause) }));
      return;
    } finally {
      inFlight.current = false;
    }
    if (!redirects) setState((previous) => ({ ...previous, pending: false }));
  };

  const retry = async () => {
    if (state.status === 'error' || state.connected) {
      callback.current = undefined;
      await reload();
      return;
    }
    await run(() => linkDiscordIdentity(returnToProfile), true);
  };
  return {
    ...state,
    connect: () => run(() => linkDiscordIdentity(returnToProfile), true),
    disconnect: () => run(unlinkDiscordIdentity),
    retry,
  };
}
