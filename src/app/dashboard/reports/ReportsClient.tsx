'use client';

import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Avatar, LinearProgress,
  Chip, Button,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { formatHours } from '@/lib/utils/format';
import { format } from 'date-fns';
import StatCard from '@/components/shared/StatCard';
import { People as PeopleIcon, AccessTime as ClockIcon, TrendingUp as TrendIcon } from '@mui/icons-material';
import DateRangePickerButton from '@/components/shared/DateRangePickerButton';
import { emitClientEvent } from '@/lib/automation/client-emitter';

interface OJTReport {
  profile: Profile;
  total_hours: number;
  total_days: number;
  completion_pct: number;
  this_month_hours: number;
  this_month_days: number;
  avg_daily_hours: number;
}

interface Props {
  initialReports: OJTReport[];
}

export default function ReportsClient({ initialReports }: Props) {
  const [reports, setReports] = useState<OJTReport[]>(initialReports);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isAllTime, setIsAllTime] = useState(true);
  const supabase = createClient();

  const fetchReports = useCallback(async (from: string, to: string, allTime: boolean) => {
    setLoading(true);

    const start = allTime ? null : (from || null);
    const end   = allTime ? null : (to || null);

    let monthAttQuery = supabase
      .from('attendance')
      .select('user_id, total_hours, date')
      .not('total_hours', 'is', null);
    if (start && end) {
      monthAttQuery = monthAttQuery.gte('date', start).lte('date', end);
    }

    const [{ data: ojts }, { data: allAtt }, { data: monthAtt }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'ojt').eq('is_active', true),
        supabase.from('attendance').select('user_id, total_hours, date').not('total_hours', 'is', null),
        monthAttQuery,
      ]);

    const result: OJTReport[] = (ojts ?? []).map((ojt) => {
      const all = (allAtt ?? []).filter((a) => a.user_id === ojt.id);
      const mon = (monthAtt ?? []).filter((a) => a.user_id === ojt.id);
      const total_hours = all.reduce((s, a) => s + (a.total_hours ?? 0), 0);
      const this_month_hours = mon.reduce((s, a) => s + (a.total_hours ?? 0), 0);
      const total_days = all.length;
      const this_month_days = mon.length;
      return {
        profile: ojt,
        total_hours,
        total_days,
        completion_pct: Math.min(100, (total_hours / ojt.required_hours) * 100),
        this_month_hours,
        this_month_days,
        avg_daily_hours: total_days > 0 ? total_hours / total_days : 0,
      };
    });

    setReports(result.sort((a, b) => b.total_hours - a.total_hours));
    setLoading(false);
  }, [supabase]);

  const handleRangeChange = ({ dateFrom: from, dateTo: to, isAllTime: all }: { dateFrom: string; dateTo: string; isAllTime: boolean }) => {
    setDateFrom(from);
    setDateTo(to);
    setIsAllTime(all);
    fetchReports(from, to, all);
  };

  const totalHours = reports.reduce((s, r) => s + r.total_hours, 0);
  const completed = reports.filter((r) => r.completion_pct >= 100).length;

  const periodLabel = isAllTime
    ? 'All Time'
    : dateFrom && dateTo
      ? `${format(new Date(dateFrom + 'T12:00'), 'MMM d, yyyy')} – ${format(new Date(dateTo + 'T12:00'), 'MMM d, yyyy')}`
      : 'Selected Period';

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Dept', 'Total Hours', 'Total Days', 'Period Hours', 'Period Days', 'Avg Daily Hours', '% Complete'];
    const rows = reports.map((r) => [
      r.profile.full_name,
      r.profile.email,
      r.profile.department ?? '',
      r.total_hours.toFixed(2),
      r.total_days,
      r.this_month_hours.toFixed(2),
      r.this_month_days,
      r.avg_daily_hours.toFixed(2),
      r.completion_pct.toFixed(1) + '%',
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${isAllTime ? 'all-time' : `${dateFrom}-to-${dateTo}`}.csv`;
    a.click();

    // Emit report.generated event
    emitClientEvent('report.generated', {
      reportType: 'csv_export',
      dateFrom: isAllTime ? undefined : dateFrom,
      dateTo: isAllTime ? undefined : dateTo,
      recordCount: reports.length,
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Reports</Typography>
          <Typography color="text.secondary">OJT attendance and progress reports</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateRangePickerButton
            dateFrom={dateFrom}
            dateTo={dateTo}
            isAllTime={isAllTime}
            onChange={handleRangeChange}
          />
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV}>
            Export CSV
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Active OJTs" value={reports.length} subtitle="This period" icon={<PeopleIcon />} color="#6366f1" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Total Hours (All)" value={formatHours(totalHours)} subtitle="All time all OJTs" icon={<ClockIcon />} color="#f59e0b" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="OJTs Complete" value={`${completed} / ${reports.length}`} subtitle="Met required hours" icon={<TrendIcon />} color="#22c55e" />
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8fafc' } }}>
                  <TableCell>OJT</TableCell>
                  <TableCell>{periodLabel} Hours</TableCell>
                  <TableCell>Total Hours</TableCell>
                  <TableCell>Days</TableCell>
                  <TableCell>Avg/Day</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>Progress</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.profile.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar src={r.profile.avatar_url} sx={{ width: 36, height: 36 }}>
                          {r.profile.full_name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{r.profile.full_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{r.profile.department ?? r.profile.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{formatHours(r.this_month_hours)}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.this_month_days} days</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{formatHours(r.total_hours)}</Typography>
                      <Typography variant="caption" color="text.secondary">of {formatHours(r.profile.required_hours)}</Typography>
                    </TableCell>
                    <TableCell>{r.total_days}</TableCell>
                    <TableCell>{formatHours(r.avg_daily_hours)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={r.completion_pct}
                          sx={{
                            flex: 1, height: 8, borderRadius: 4,
                            '& .MuiLinearProgress-bar': {
                              background: r.completion_pct >= 100 ? '#22c55e' : '#6366f1',
                            },
                          }}
                        />
                        <Typography variant="caption" fontWeight={600} sx={{ minWidth: 38 }}>
                          {r.completion_pct.toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={r.completion_pct >= 100 ? 'Complete' : 'In Progress'}
                        color={r.completion_pct >= 100 ? 'success' : 'primary'}
                        size="small"
                        variant={r.completion_pct >= 100 ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
