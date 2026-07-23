'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Attendance, AttendanceSummary } from '@/types';
import { format } from 'date-fns';

export function useAttendance(userId?: string) {
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
  const supabase = useMemo(() => createClient(), []);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const fetchTodayRecord = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();
    setTodayRecord(data);
  }, [userId, today, supabase]);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30);
    setHistory(data ?? []);
  }, [userId, supabase]);

  const fetchSummary = useCallback(async () => {
    if (!userId) return;
    const { data: profileData } = await supabase
      .from('profiles')
      .select('required_hours')
      .eq('id', userId)
      .single();

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('total_hours')
      .eq('user_id', userId)
      .not('total_hours', 'is', null);

    const required = profileData?.required_hours ?? 600;
    const totalHours = (attendanceData ?? []).reduce(
      (acc, row) => acc + (row.total_hours ?? 0),
      0
    );

    setSummary({
      total_days: (attendanceData ?? []).length,
      total_hours: totalHours,
      required_hours: required,
      remaining_hours: Math.max(0, required - totalHours),
      completion_percentage: Math.min(100, (totalHours / required) * 100),
    });
  }, [userId, supabase]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTodayRecord(), fetchHistory(), fetchSummary()]);
    setLoading(false);
  }, [fetchTodayRecord, fetchHistory, fetchSummary]);

  useEffect(() => {
    let isMounted = true;
    if (!userId) return;

    const loadData = async () => {
      await Promise.allSettled([
        fetchTodayRecord(),
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
  }, [userId, fetchTodayRecord, fetchHistory, fetchSummary]);

  return { todayRecord, history, summary, loading, refresh };
}
