'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar, TextField,
  InputAdornment, IconButton, Tooltip, Skeleton,
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { Attendance, Profile } from '@/types';
import { formatDate, formatTime, formatHours } from '@/lib/utils/format';
import DateRangePickerButton from '@/components/shared/DateRangePickerButton';

interface Props {
  userId?: string; // if undefined, shows all (for admin/supervisor)
  showUser?: boolean;
  initialRecords?: (Attendance & { profile?: Profile })[];
}

export default function AttendanceTable({ userId, showUser = false, initialRecords }: Props) {
  const [records, setRecords] = useState<(Attendance & { profile?: Profile })[]>(initialRecords ?? []);
  const [loading, setLoading] = useState(!initialRecords);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isAllTime, setIsAllTime] = useState(true);
  const supabase = createClient();

  const fetchRecords = useCallback(async (from: string, to: string, allTime: boolean) => {
    setLoading(true);

    let query = supabase
      .from('attendance')
      .select('*, profile:profiles(id, full_name, email, avatar_url, department)')
      .order('date', { ascending: false });

    if (!allTime && from && to) {
      query = query.gte('date', from).lte('date', to);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data } = await query;
    setRecords(data ?? []);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchRecords('', '', true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const filtered = records.filter((r) => {
    if (!search) return true;
    const name = r.profile?.full_name?.toLowerCase() ?? '';
    return name.includes(search.toLowerCase()) || r.date.includes(search);
  });

  const exportCSV = () => {
    const headers = ['Date', 'Name', 'Clock In', 'Clock Out', 'Total Hours', 'Status'];
    const rows = filtered.map((r) => [
      r.date,
      r.profile?.full_name ?? 'N/A',
      r.clock_in ? formatTime(r.clock_in) : '',
      r.clock_out ? formatTime(r.clock_out) : '',
      r.total_hours ? formatHours(r.total_hours) : '',
      r.clock_out ? 'Complete' : r.clock_in ? 'In Progress' : 'Absent',
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${isAllTime ? 'all-time' : `${dateFrom}-to-${dateTo}`}.csv`;
    a.click();
  };

  const statusChip = (record: Attendance) => {
    if (record.clock_out)
      return <Chip label="Complete" color="success" size="small" icon={<CheckIcon />} />;
    if (record.clock_in)
      return <Chip label="In Progress" color="warning" size="small" />;
    return <Chip label="Absent" color="error" size="small" icon={<CancelIcon />} />;
  };

  const handleRangeChange = ({ dateFrom: from, dateTo: to, isAllTime: all }: { dateFrom: string; dateTo: string; isAllTime: boolean }) => {
    setDateFrom(from);
    setDateTo(to);
    setIsAllTime(all);
    fetchRecords(from, to, all);
  };

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h6" fontWeight={700}>Attendance Records</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <DateRangePickerButton
              dateFrom={dateFrom}
              dateTo={dateTo}
              isAllTime={isAllTime}
              onChange={handleRangeChange}
            />
            {showUser && (
              <TextField
                size="small"
                placeholder="Search name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            )}
            <Tooltip title="Export CSV">
              <IconButton
                onClick={exportCSV}
                size="small"
                sx={{
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': { bgcolor: 'action.selected' },
                }}
                aria-label="Export CSV"
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Date</TableCell>
                {showUser && <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Name</TableCell>}
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Clock In</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Clock Out</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Hours</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: showUser ? 6 : 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : filtered.map((record) => (
                    <TableRow
                      key={record.id}
                      sx={{ '&:hover': { bgcolor: 'action.hover' }, '&:last-child td': { border: 0 } }}
                    >
                      <TableCell>{formatDate(record.date)}</TableCell>
                      {showUser && (
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar
                              src={record.profile?.avatar_url}
                              sx={{ width: 28, height: 28, fontSize: 12 }}
                            >
                              {record.profile?.full_name?.charAt(0)}
                            </Avatar>
                            <Typography variant="body2">{record.profile?.full_name}</Typography>
                          </Box>
                        </TableCell>
                      )}
                      <TableCell>
                        {record.clock_in ? formatTime(record.clock_in) : '—'}
                      </TableCell>
                      <TableCell>
                        {record.clock_out ? formatTime(record.clock_out) : '—'}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={record.total_hours ? 'success.main' : 'text.secondary'}
                        >
                          {record.total_hours ? formatHours(record.total_hours) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>{statusChip(record)}</TableCell>
                    </TableRow>
                  ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showUser ? 6 : 5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No attendance records found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
