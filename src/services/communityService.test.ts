import { beforeEach, expect, it, vi } from 'vitest';
import { getCommunityMember, listCommunityMembers } from './communityService';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({ rpc }) }));
const member = {
  memberKey: 'public-key',
  name: 'Ana',
  avatarUrl: '',
  bio: '',
  primaryRole: 'QA',
  areas: ['QA'],
  interests: ['APIs'],
  technologies: [],
};
beforeEach(() => rpc.mockReset());
it('passes paginated search filters to the server and returns only public fields', async () => {
  rpc.mockResolvedValue({
    data: {
      members: [{ ...member, email: 'private@test', platform_role: 'ADMIN', user_id: 'auth-id' }],
      hasMore: true,
    },
  });
  const result = await listCommunityMembers('Ana', 'QA', 'APIs', 2);
  expect(rpc).toHaveBeenCalledWith('list_community_members', {
    p_search: 'Ana',
    p_area: 'QA',
    p_interest: 'APIs',
    p_page: 2,
  });
  expect(result).toEqual({ members: [member], hasMore: true });
});
it('opens another member by public key without propagating internal fields or unsafe URLs', async () => {
  rpc.mockResolvedValue({
    data: {
      ...member,
      email: 'private@test',
      provider_user_id: 'secret-id',
      links: { github: 'javascript:alert(1)', linkedin: 'https://example.com/' },
      discordConnected: true,
      projects: [{ name: 'App', status: 'ACTIVE', role: 'QA', owner_id: 'private' }],
      evidence: [],
    },
  });
  const result = await getCommunityMember('public-key');
  expect(rpc).toHaveBeenCalledWith('get_community_member', { p_member_key: 'public-key' });
  expect(result?.links.github).toBeUndefined();
  expect(JSON.stringify(result)).not.toMatch(/private|secret-id|email|provider_user_id|owner_id/);
});
it('propagates access failures instead of returning an empty community', async () => {
  rpc.mockResolvedValue({ error: new Error('permission denied') });
  await expect(listCommunityMembers('', '', '', 0)).rejects.toThrow('permission denied');
});
