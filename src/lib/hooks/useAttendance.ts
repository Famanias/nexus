'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Attendance, AttendanceSummary } from '@/types';
import { getAttendanceSummary } from '@/lib/attendance/summary';
import { format } from 'date-fns';

export interface UseAttendanceOptions {
  initialTodayRecords?: Attendance[];
  initialSummary?: AttendanceSummary | null;
  initialHistory?: Attendance[];
  skipMountFetch?: boolean;
}

export function useAttendance(userId?: string, options?: UseAttendanceOptions) {
  const [todayRecords, setTodayRecords] = useState<Attendance[]>(
    options?.initialTodayRecords ?? []
  );
  const [history, setHistory] = useState<Attendance[]>(
    options?.initialHistory ?? []
  );
  const [summary, setSummary] = useState<AttendanceSummary | null>(
    options?.initialSummary ?? null
  );
  const [loading, setLoading] = useState<boolean>(
    !options?.initialSummary && !options?.skipMountFetch && Boolean(userId)
  );

  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const initialMounted = useRef(false);

  const fetchTodayRecords = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .order('clock_in', { ascending: true });
    setTodayRecords(data ?? []);
  }, [userId, today, supabase]);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('clock_in', { ascending: false })
      .limit(50);
    setHistory(data ?? []);
  }, [userId, supabase]);

  const fetchSummary = useCallback(async () => {
    if (!userId) return;
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const sum = await getAttendanceSummary(supabase, userId, profileData ?? undefined);
    setSummary(sum);
  }, [userId, supabase]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTodayRecords(), fetchHistory(), fetchSummary()]);
    setLoading(false);
  }, [fetchTodayRecords, fetchHistory, fetchSummary]);

  useEffect(() => {
    let isMounted = true;
    if (!userId) return;

    // Skip mount auto-fetch if initial data was provided or skip flag set
    const shouldSkipMount =
      !initialMounted.current &&
      (options?.skipMountFetch || options?.initialSummary !== undefined);
    initialMounted.current = true;

    if (shouldSkipMount) {
      return;
    }

    const loadData = async () => {
      await Promise.allSettled([
        fetchTodayRecords(),
        fetchHistory(),
        fetchSummary(),
      ]);
      if (isMounted) {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [userId, options?.skipMountFetch, options?.initialSummary, fetchTodayRecords, fetchHistory, fetchSummary]);

  // Active open session without clock_out
  const activeRecord = useMemo(
    () => todayRecords.find((r) => !r.clock_out) ?? null,
    [todayRecords]
  );
  // Latest session today
  const latestRecord = useMemo(
    () => (todayRecords.length > 0 ? todayRecords[todayRecords.length - 1] : null),
    [todayRecords]
  );
  // todayRecord: active shift if clocked in, else latest shift
  const todayRecord = activeRecord ?? latestRecord;

  return { todayRecord, todayRecords, activeRecord, history, summary, loading, refresh };
}
