import { getSupabase } from '../lib/supabase';

const types: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function validateAvatar(file: File): string {
  const extension = types[file.type];
  if (!extension) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
  if (file.size > 2 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 2 MB.');
  return extension;
}

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const extension = validateAvatar(file);
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const client = getSupabase();
  const { error } = await client.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return {
    path,
    url: client.storage.from('avatars').getPublicUrl(path).data.publicUrl,
  };
}

export function ownAvatarPath(url: string | undefined, userId: string): string | undefined {
  if (!url) return undefined;
  const marker = '/storage/v1/object/public/avatars/';
  const parsed = new URL(url, window.location.origin);
  const index = parsed.pathname.indexOf(marker);
  if (index < 0) return undefined;
  const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
  return path.startsWith(`${userId}/`) && !path.includes('..') ? path : undefined;
}

export async function deleteAvatar(path: string): Promise<void> {
  const { error } = await getSupabase().storage.from('avatars').remove([path]);
  if (error) throw error;
}
