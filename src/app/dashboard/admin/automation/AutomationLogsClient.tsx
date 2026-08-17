'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Tooltip, Alert, Pagination
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Replay as RetryIcon,
  Delete as DeleteIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useToast } from '@/lib/context/ToastContext';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface Metrics {
  eventsToday: number;
  successPercent: number;
  failedPercent: number;
  avgRuntimeMs: number;
  totalRetries: number;
  mostTriggeredEvent: string;
  slowestWorkflow: string;
}

interface LogEntry {
  id: string;
  event_id: string;
  event_type: string;
  workflow_name: string;
  status: string;
  attempt_count: number;
  duration_ms: number;
  created_at: string;
  error_message?: string;
  request_payload?: unknown;
  response_payload?: unknown;
}

interface DeadLetter {
  id: string;
  event_id: string;
  event_type: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  payload?: unknown;
  created_at: string;
  last_attempt_at: string;
}

export default function AutomationLogsClient() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [selectedDeadLetter, setSelectedDeadLetter] = useState<DeadLetter | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    type: 'replay' | 'discard';
    id: string;
  }>({
    open: false,
    type: 'replay',
    id: '',
  });

  const toast = useToast();

  const fetchLogs = async (p = 1) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch(`/api/automation/logs?page=${p}&limit=20`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setLogs(data.logs);
      setMetrics(data.metrics);
      setTotalPages(data.pagination.totalPages);
      setPage(p);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchDeadLetters = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch(`/api/automation/dead-letters?status=failed`);
      if (!res.ok) throw new Error('Failed to fetch dead letters');
      const data = await res.json();
      setDeadLetters(data.deadLetters);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 0) {
      fetchLogs(1);
    } else {
      fetchDeadLetters();
    }
  }, [tab]);

  const handleReplayClick = (id: string) => {
    setConfirmState({ open: true, type: 'replay', id });
  };

  const handleDiscardClick = (id: string) => {
    setConfirmState({ open: true, type: 'discard', id });
  };

  const executeConfirmedAction = async () => {
    const { type, id } = confirmState;
    if (!id) return;

    try {
      setActionLoading(true);
      if (type === 'replay') {
        const res = await fetch('/api/automation/dead-letters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error('Replay failed');
        toast.showSuccess('Event queued for replay.');
      } else {
        const res = await fetch(`/api/automation/dead-letters?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Discard failed');
        toast.showSuccess('Event discarded successfully.');
      }
      setConfirmState({ open: false, type: 'replay', id: '' });
      await fetchDeadLetters();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.showError(msg || (type === 'replay' ? 'Failed to replay event.' : 'Failed to discard event.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3, pb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700} color="text.primary">
          Automation
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={() => tab === 0 ? fetchLogs(page) : fetchDeadLetters()}
          variant="outlined"
          color="inherit"
        >
          Refresh
        </Button>
      </Box>

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{errorMsg}</Alert>
      )}

      {/* Metrics Section */}
      {metrics && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { label: 'Events Today', value: metrics.eventsToday },
            { label: 'Success Rate', value: `${metrics.successPercent}%`, color: '#10b981' },
            { label: 'Failed Rate', value: `${metrics.failedPercent}%`, color: '#ef4444' },
            { label: 'Avg Runtime', value: `${metrics.avgRuntimeMs}ms` },
            { label: 'Total Retries', value: metrics.totalRetries },
            { label: 'Top Event', value: metrics.mostTriggeredEvent },
            { label: 'Slowest', value: metrics.slowestWorkflow || 'N/A' },
          ].map((m, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3, lg: 12 / 7 }} key={i}>
              <Card sx={{ bgcolor: 'background.paper', height: '100%' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    {m.label}
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color={m.color || 'text.primary'} noWrap>
                    {m.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 3 }}
      >
        <Tab label="Execution Logs" />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Failed Events
              {deadLetters.length > 0 && tab !== 1 && (
                <Chip label={deadLetters.length} size="small" color="error" sx={{ height: 20 }} />
              )}
            </Box>
          }
        />
      </Tabs>

      {/* Content */}
      <Paper sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
        ) : tab === 0 ? (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Event Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Retries</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4, borderBottom: 'none' }}>No logs found.</TableCell></TableRow>
                  ) : (
                    logs.map(log => (
                      <TableRow key={log.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell>
                          <Chip
                            icon={log.status === 'success' ? <SuccessIcon /> : log.status === 'failed' ? <ErrorIcon /> : <WarningIcon />}
                            label={log.status}
                            size="small"
                            color={log.status === 'success' ? 'success' : log.status === 'failed' ? 'error' : 'warning'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{log.event_type}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{log.duration_ms}ms</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{log.attempt_count - 1}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{format(new Date(log.created_at), 'MMM d, HH:mm:ss')}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="View Payload">
                            <IconButton size="small" onClick={() => setSelectedLog(log)} aria-label="View payload">
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {totalPages > 1 && (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: 'none' }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, p) => fetchLogs(p)}
                />
              </Box>
            )}
          </>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Event Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Error Message</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Failed At</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deadLetters.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 4, borderBottom: 'none' }}>No failed events in queue.</TableCell></TableRow>
                ) : (
                  deadLetters.map(dl => (
                    <TableRow key={dl.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{dl.event_type}</TableCell>
                      <TableCell sx={{ color: 'error.main', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dl.error_message || 'Unknown error'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{format(new Date(dl.created_at), 'MMM d, HH:mm:ss')}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Inspect Payload">
                          <IconButton size="small" onClick={() => setSelectedDeadLetter(dl)} aria-label="Inspect payload">
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Retry Event">
                          <IconButton size="small" onClick={() => handleReplayClick(dl.id)} color="success" disabled={actionLoading} aria-label="Retry event">
                            <RetryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Discard">
                          <IconButton size="small" onClick={() => handleDiscardClick(dl.id)} color="error" disabled={actionLoading} aria-label="Discard event">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Log Detail Dialog */}
      <Dialog
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', fontWeight: 700 }}>Execution Details</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {selectedLog?.error_message && (
            <Alert severity="error" sx={{ mb: 2 }}>{selectedLog.error_message}</Alert>
          )}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Request Payload</Typography>
          <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'auto', mb: 3, fontSize: 12 }}>
            {selectedLog?.request_payload ? JSON.stringify(selectedLog.request_payload, null, 2) : 'Not stored (log level is minimal or errors-only)'}
          </Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Response Payload</Typography>
          <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'auto', fontSize: 12 }}>
            {selectedLog?.response_payload ? JSON.stringify(selectedLog.response_payload, null, 2) : 'Not stored'}
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', p: 2 }}>
          <Button onClick={() => setSelectedLog(null)} color="inherit">Close</Button>
        </DialogActions>
      </Dialog>

      {/* Dead Letter Dialog */}
      <Dialog
        open={!!selectedDeadLetter}
        onClose={() => setSelectedDeadLetter(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', fontWeight: 700 }}>Failed Event Details</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>{selectedDeadLetter?.error_message}</Alert>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Full Payload for Recovery</Typography>
          <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(selectedDeadLetter?.payload, null, 2)}
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', p: 2 }}>
          <Button onClick={() => setSelectedDeadLetter(null)} color="inherit">Close</Button>
          <Button
            onClick={() => {
              if (selectedDeadLetter) {
                const id = selectedDeadLetter.id;
                setSelectedDeadLetter(null);
                handleReplayClick(id);
              }
            }}
            variant="contained"
            color="success"
            disabled={actionLoading}
          >
            Retry Event
          </Button>
        </DialogActions>
      </Dialog>

      {/* Accessible Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.type === 'replay' ? 'Replay Failed Event' : 'Discard Failed Event'}
        content={
          confirmState.type === 'replay'
            ? 'Are you sure you want to replay this failed event?'
            : 'Are you sure you want to discard this event? It cannot be recovered.'
        }
        confirmText={confirmState.type === 'replay' ? 'Replay Event' : 'Discard Event'}
        confirmColor={confirmState.type === 'replay' ? 'primary' : 'error'}
        loading={actionLoading}
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmState({ open: false, type: 'replay', id: '' })}
      />
    </Box>
  );
}
