import { useEffect, useState } from 'react';

export function useCommunityQuery<T>(read: () => Promise<T>, refreshKey: number) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    setData(undefined);
    const refresh = async () => {
      const current = ++sequence;
      setLoading(true);
      setError('');
      try {
        const next = await read();
        if (active && current === sequence) setData(next);
      } catch {
        if (active && current === sequence)
          setError('Não foi possível atualizar os dados da comunidade.');
      } finally {
        if (active && current === sequence) setLoading(false);
      }
    };
    const focus = () => {
      if (document.visibilityState !== 'hidden') void refresh();
    };
    void refresh();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      active = false;
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [read, refreshKey, retryKey]);
  return { data, loading, error, retry: () => setRetryKey((key) => key + 1) };
}
