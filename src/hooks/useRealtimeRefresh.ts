import { useEffect, useRef } from 'react';

const DATA_CHANGED_EVENT = 'logia:data-changed';

export function useRealtimeRefresh(refresh: () => void): void {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const handleDataChanged = () => refreshRef.current();
    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged);
  }, []);
}

export { DATA_CHANGED_EVENT };
