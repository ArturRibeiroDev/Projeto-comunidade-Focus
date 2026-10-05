import { useState } from 'react';
import { safeExternalUrl } from '../../utils/profileFields';

export function Avatar({
  name,
  src,
  className = '',
}: {
  name: string;
  src?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const url = src?.includes('api.dicebear.com/') ? undefined : safeExternalUrl(src);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?';
  return url && failed !== url ? (
    <img className={`avatar ${className}`} src={url} alt="" onError={() => setFailed(url)} />
  ) : (
    <span className={`avatar avatar-fallback ${className}`} aria-label={`Avatar de ${name}`}>
      {initials}
    </span>
  );
}
