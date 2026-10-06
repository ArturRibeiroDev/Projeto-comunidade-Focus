export type DiscordChannel = {
  id: string;
  name: string;
  topic?: string | null;
  parent_id?: string | null;
  type: number;
};

export type ChannelOverwrite = {
  id: string;
  type: 0 | 1;
  allow: string;
  deny: string;
};

export class DiscordApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly retryAfterMs = 0,
  ) {
    super(status === 429 ? 'Limite de chamadas do Discord' : `Discord API: HTTP ${status}`);
  }
}

const VIEW_CHANNEL = 1024;
const SEND_MESSAGES = 2048;
const READ_HISTORY = 65536;

export function channelName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 94)
    .replace(/-$/g, '');
  return `squad-${slug || 'projeto'}`;
}

export function channelTopic(projectId: string): string {
  return `FocusAcademy project:${projectId}`;
}

export function channelOverwrites(
  guildId: string,
  botId: string,
  memberIds: string[],
  readOnly: boolean,
): ChannelOverwrite[] {
  const access = VIEW_CHANNEL | READ_HISTORY | (readOnly ? 0 : SEND_MESSAGES);
  const denied = readOnly ? SEND_MESSAGES : 0;
  return [
    { id: guildId, type: 0, allow: '0', deny: String(VIEW_CHANNEL) },
    { id: botId, type: 1, allow: String(VIEW_CHANNEL | SEND_MESSAGES | READ_HISTORY), deny: '0' },
    ...[...new Set(memberIds)]
      .filter((id) => id !== botId)
      .map((id) => ({
        id,
        type: 1 as const,
        allow: String(access),
        deny: String(denied),
      })),
  ];
}

export class DiscordClient {
  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async request<T>(
    path: string,
    method = 'GET',
    body?: object,
    parseJson = true,
  ): Promise<T> {
    const response = await this.fetcher(`https://discord.com/api/v10${path}`, {
      method,
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bot ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const header = Number(response.headers.get('retry-after'));
      const retryAfterMs = response.status === 429 && Number.isFinite(header) ? header * 1000 : 0;
      throw new DiscordApiError(response.status, retryAfterMs);
    }
    if (!parseJson || response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async botId(): Promise<string> {
    const bot = await this.request<{ id: string }>('/users/@me');
    return bot.id;
  }

  async guildChannels(guildId: string): Promise<DiscordChannel[]> {
    return this.request<DiscordChannel[]>(`/guilds/${guildId}/channels`);
  }

  async guildMember(guildId: string, userId: string): Promise<boolean> {
    try {
      await this.request(`/guilds/${guildId}/members/${userId}`);
      return true;
    } catch (error) {
      if (error instanceof DiscordApiError && error.status === 404) return false;
      throw error;
    }
  }

  async createChannel(
    guildId: string,
    name: string,
    topic: string,
    parentId: string,
    overwrites: ChannelOverwrite[],
  ): Promise<DiscordChannel> {
    return this.request<DiscordChannel>(`/guilds/${guildId}/channels`, 'POST', {
      name,
      topic,
      type: 0,
      parent_id: parentId,
      permission_overwrites: overwrites,
    });
  }

  async updateChannel(channelId: string, parentId: string, topic: string): Promise<void> {
    await this.request(`/channels/${channelId}`, 'PATCH', {
      parent_id: parentId,
      topic,
      lock_permissions: false,
    });
  }

  async putChannelPermission(channelId: string, overwrite: ChannelOverwrite): Promise<void> {
    await this.request(
      `/channels/${channelId}/permissions/${overwrite.id}`,
      'PUT',
      {
        allow: overwrite.allow,
        deny: overwrite.deny,
        type: overwrite.type,
      },
      false,
    );
  }

  async sendMessage(channelId: string, content: string, eventId: string): Promise<string> {
    const message = await this.request<{ id: string }>(`/channels/${channelId}/messages`, 'POST', {
      content: content.slice(0, 1900),
      allowed_mentions: { parse: [] },
      nonce: eventId.replace(/-/g, '').slice(0, 25),
      enforce_nonce: true,
    });
    return message.id;
  }
}
