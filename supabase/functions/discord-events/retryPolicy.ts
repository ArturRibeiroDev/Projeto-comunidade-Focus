import { DiscordApiError } from './discord.ts';
import { DiscordSyncError } from './processor.ts';

export const maxDiscordEventAttempts = 5;
export const discordBackoffMs = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

export type ClassifiedDiscordFailure = {
  message: string;
  retryable: boolean;
  retryAfterMs: number;
};

export function isRetryableDiscordStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

export function classifyDiscordEventFailure(error: unknown): ClassifiedDiscordFailure {
  if (error instanceof DiscordApiError) {
    const retryAfterMs = error.status === 429 ? Math.max(error.retryAfterMs, 30_000) : 0;
    return {
      message: error.message,
      retryable: isRetryableDiscordStatus(error.status),
      retryAfterMs,
    };
  }
  if (error instanceof DiscordSyncError) {
    const retryAfterMs = error.retryAfterMs ? Math.max(error.retryAfterMs, 30_000) : 0;
    return {
      message: error.message,
      retryable: error.retryable,
      retryAfterMs,
    };
  }
  if (error instanceof Error && error.message.startsWith('Configuração ausente:')) {
    return { message: 'Integração Discord não configurada', retryable: false, retryAfterMs: 0 };
  }
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
    return { message: 'Timeout ao sincronizar Discord', retryable: true, retryAfterMs: 0 };
  }
  return { message: 'Falha ao sincronizar Discord', retryable: true, retryAfterMs: 0 };
}

export function nextDiscordRetryAt(
  failure: ClassifiedDiscordFailure,
  attempts: number,
  now = Date.now(),
): string | null {
  if (!failure.retryable || attempts >= maxDiscordEventAttempts) return null;
  const delay =
    failure.retryAfterMs ||
    discordBackoffMs[Math.min(Math.max(attempts - 1, 0), discordBackoffMs.length - 1)];
  return new Date(now + delay).toISOString();
}
