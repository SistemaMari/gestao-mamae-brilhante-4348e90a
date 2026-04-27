import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type TableName =
  | 'pacientes'
  | 'laudos'
  | 'consultas'
  | 'exames_glicemia'
  | 'perfis_glicemicos'
  | 'valores_perfil';

interface Options {
  /** Tables to subscribe to */
  tables: TableName[];
  /** Called (debounced) whenever any of the tables changes */
  onChange: () => void;
  /** Optional unique channel name; defaults to a random one */
  channelName?: string;
  /** Skip subscription (e.g. preview mode or unauthenticated) */
  enabled?: boolean;
  /** Debounce ms to coalesce bursts of changes */
  debounceMs?: number;
}

/**
 * Subscribe to Supabase realtime changes on one or more tables and trigger a refresh callback.
 * RLS is applied server-side, so users only receive events for rows they can already SELECT.
 * Returns a connection status that can drive a small "Ao vivo" indicator.
 */
export function useRealtimeRefresh({
  tables,
  onChange,
  channelName,
  enabled = true,
  debounceMs = 400,
}: Options) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    setStatus('connecting');
    const name = channelName ?? `rt-${tables.join('-')}-${Math.random().toString(36).slice(2, 8)}`;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    let channel = supabase.channel(name);
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => trigger(),
      );
    }

    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') setStatus('live');
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setStatus('error');
    });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tables.join('|'), channelName, debounceMs]);

  return status;
}
