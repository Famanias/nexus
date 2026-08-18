import { createClient } from '@/lib/supabase/server';
import { Box, Typography } from '@mui/material';
import AttendanceTable from '@/components/attendance/AttendanceTable';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  const isOjt = profile?.role === 'ojt';
  const month = format(new Date(), 'yyyy-MM');
  const start = format(startOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');
  const end = format(endOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');

  let query = supabase
    .from('attendance')
    .select('*, profile:profiles(id, full_name, email, avatar_url, department)')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .order('clock_in', { ascending: false });

  if (isOjt) query = query.eq('user_id', user!.id);

  const { data: records } = await query;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800}>Attendance Records</Typography>
        <Typography color="text.secondary">
          {isOjt ? 'Your attendance history' : 'All OJT attendance records'}
        </Typography>
      </Box>

      <AttendanceTable
        userId={isOjt ? user!.id : undefined}
        showUser={!isOjt}
        initialRecords={records ?? []}
      />
    </Box>
  );
}
