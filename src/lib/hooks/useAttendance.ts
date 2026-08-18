'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Attendance, AttendanceSummary } from '@/types';
import { computeAttendanceSummary } from '@/lib/attendance/summary';
import { format } from 'date-fns';

export function useAttendance(userId?: string) {
  const [todayRecords, setTodayRecords] = useState<Attendance[]>([]);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
  const supabase = useMemo(() => createClient(), []);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

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
      .select('required_hours, role, system_role')
      .eq('id', userId)
      .single();

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('total_hours, date')
      .eq('user_id', userId)
      .not('total_hours', 'is', null);

    setSummary(
      computeAttendanceSummary({
        rows: attendanceData ?? [],
        requiredHours: profileData?.required_hours ?? 0,
        role: profileData?.role,
        systemRole: profileData?.system_role,
      })
    );
  }, [userId, supabase]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTodayRecords(), fetchHistory(), fetchSummary()]);
    setLoading(false);
  }, [fetchTodayRecords, fetchHistory, fetchSummary]);

  useEffect(() => {
    let isMounted = true;
    if (!userId) return;

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
  }, [userId, fetchTodayRecords, fetchHistory, fetchSummary]);

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
