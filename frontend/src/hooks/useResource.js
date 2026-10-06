import { useCallback, useEffect, useState } from 'react';

export default function useResource(loadResource, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await loadResource();
      setData(response);
      return response;
    } catch (loadError) {
      setError(loadError.message || 'Unable to load this information.');
      return null;
    } finally {
      setLoading(false);
    }
  // The caller controls reloads through its dependency list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}
