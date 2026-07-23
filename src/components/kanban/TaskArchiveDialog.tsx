'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Chip, Avatar, IconButton,
  Tooltip, CircularProgress, Alert, Divider, TextField,
  InputAdornment, LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  DeleteForever as PermDeleteIcon,
  Restore as RestoreIcon,
  Archive as ArchiveIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { KanbanTask, KanbanColumn, Profile } from '@/types';
import { formatDate, priorityColor } from '@/lib/utils/format';

interface ArchivedTask extends KanbanTask {
  archived_by_profile?: Profile;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  columns: KanbanColumn[];
  currentUser: Profile;
}

export default function TaskArchiveDialog({ open, onClose, onRefresh, columns, currentUser }: Props) {
  const [tasks, setTasks] = useState<ArchivedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retentionDays, setRetentionDays] = useState(7);
  const [retentionInput, setRetentionInput] = useState('7');
  const [savingRetention, setSavingRetention] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const supabase = createClient();

  const isAdmin = currentUser.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const [{ data: tasksData, error: tErr }, { data: settings }] = await Promise.all([
      supabase
        .from('kanban_tasks')
        .select(`
          *,
          assignee:profiles!kanban_tasks_assignee_id_fkey(id, full_name, avatar_url),
          archived_by_profile:profiles!kanban_tasks_archived_by_fkey(id, full_name, avatar_url),
          attachments:task_attachments(*)
        `)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false }),
      supabase.from('site_settings').select('archive_retention_days').single(),
    ]);

    if (tErr) { setError(tErr.message); setLoading(false); return; }

    const days = settings?.archive_retention_days ?? 7;
    setRetentionDays(days);
    setRetentionInput(String(days));

    // Auto-purge expired tasks
    const now = Date.now();
    const expiredIds = (tasksData ?? [])
      .filter((t: KanbanTask) => {
        if (!t.archived_at) return false;
        const archivedMs = new Date(t.archived_at).getTime();
        return now - archivedMs >= days * 24 * 60 * 60 * 1000;
      })
      .map((t: KanbanTask) => t.id);

    if (expiredIds.length > 0) {
      await supabase.from('kanban_tasks').delete().in('id', expiredIds);
    }

    const remaining = (tasksData ?? []).filter(
      (t: KanbanTask) =>
        t.archived_at &&
        now - new Date(t.archived_at).getTime() < days * 24 * 60 * 60 * 1000
    );
    setTasks(remaining as ArchivedTask[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    if (open) {
      Promise.resolve().then(async () => {
        if (!active) return;
        await load();
      });
    }
    return () => {
      active = false;
    };
  }, [open, load]);

  const [mountTime] = useState(() => Date.now());

  const restoreTask = async (taskId: string) => {
    setProcessingId(taskId);
    await supabase
      .from('kanban_tasks')
      .update({ archived_at: null, archived_by: null })
      .eq('id', taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    onRefresh();
    setProcessingId(null);
  };

  const permanentlyDelete = async (taskId: string) => {
    setProcessingId(taskId);
    await supabase.from('kanban_tasks').delete().eq('id', taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setProcessingId(null);
  };

  const saveRetention = async () => {
    const days = parseInt(retentionInput, 10);
    if (!days || days < 1) return;
    setSavingRetention(true);
    await supabase.from('site_settings').update({ archive_retention_days: days }).neq('id', '');
    setRetentionDays(days);
    setSavingRetention(false);
    load();
  };

  const daysRemaining = (archivedAt: string) => {
    const ms = mountTime - new Date(archivedAt).getTime();
    const daysPassed = ms / (1000 * 60 * 60 * 24);
    return Math.max(0, retentionDays - daysPassed);
  };

  const columnName = (colId: string) =>
    columns.find((c) => c.id === colId)?.title ?? 'Unknown Column';

  const columnColor = (colId: string) =>
    columns.find((c) => c.id === colId)?.color ?? '#6366f1';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArchiveIcon sx={{ color: '#6366f1' }} />
          <Typography variant="h6" fontWeight={700}>Task Archives</Typography>
          <Chip
            label={`${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
            size="small"
            sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600 }}
          />
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {/* Retention settings (admin only) */}
        {isAdmin && (
          <Box
            sx={{
              px: 3, py: 2, bgcolor: '#fafafa',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            }}
          >
            <SettingsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Permanent deletion after:
            </Typography>
            <TextField
              size="small"
              type="number"
              value={retentionInput}
              onChange={(e) => setRetentionInput(e.target.value)}
              InputProps={{
                inputProps: { min: 1, max: 365 },
                endAdornment: <InputAdornment position="end">days</InputAdornment>,
              }}
              sx={{ width: 120 }}
            />
            <Button
              size="small"
              variant="contained"
              startIcon={savingRetention ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
              onClick={saveRetention}
              disabled={savingRetention || retentionInput === String(retentionDays)}
            >
              Save
            </Button>
            <Typography variant="caption" color="text.secondary">
              (currently {retentionDays} days — expired tasks are removed automatically on open)
            </Typography>
          </Box>
        )}

        {loading && <LinearProgress />}

        {error && (
          <Box sx={{ px: 3, pt: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {!loading && tasks.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center', color: '#94a3b8' }}>
            <ArchiveIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
            <Typography variant="body1">No archived tasks</Typography>
          </Box>
        )}

        {tasks.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {tasks.map((task, idx) => {
              const pColor = priorityColor(task.priority);
              const remaining = daysRemaining(task.archived_at!);
              const urgentPurge = remaining < 1;
              const isProcessing = processingId === task.id;

              return (
                <React.Fragment key={task.id}>
                  {idx > 0 && <Divider />}
                  <Box
                    sx={{
                      px: 3, py: 2,
                      display: 'flex', alignItems: 'center', gap: 2,
                      borderLeft: `4px solid ${pColor}`,
                      opacity: isProcessing ? 0.5 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {/* Task info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {task.title}
                        </Typography>
                        <Chip
                          label={task.priority}
                          size="small"
                          sx={{ bgcolor: `${pColor}20`, color: pColor, fontWeight: 600, fontSize: 10, height: 18, textTransform: 'capitalize' }}
                        />
                        <Chip
                          label={columnName(task.column_id)}
                          size="small"
                          sx={{ bgcolor: `${columnColor(task.column_id)}20`, color: columnColor(task.column_id), fontWeight: 600, fontSize: 10, height: 18 }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        {task.archived_at && (
                          <Typography variant="caption" color="text.secondary">
                            Archived {formatDate(task.archived_at)}
                          </Typography>
                        )}
                        {task.archived_by_profile && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">by</Typography>
                            <Avatar src={task.archived_by_profile.avatar_url} sx={{ width: 16, height: 16, fontSize: 8 }}>
                              {task.archived_by_profile.full_name?.charAt(0)}
                            </Avatar>
                            <Typography variant="caption" color="text.secondary">
                              {task.archived_by_profile.full_name}
                            </Typography>
                          </Box>
                        )}
                        {task.due_date && (
                          <Typography variant="caption" color="text.secondary">
                            Due {formatDate(task.due_date)}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Days remaining */}
                    <Box sx={{ textAlign: 'center', minWidth: 80, flexShrink: 0 }}>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ color: urgentPurge ? '#ef4444' : remaining < 2 ? '#f59e0b' : '#64748b' }}
                      >
                        {urgentPurge ? '<1 day' : `${Math.ceil(remaining)}d`}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.disabled">
                        until purge
                      </Typography>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      <Tooltip title="Restore task to board">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={isProcessing}
                            onClick={() => restoreTask(task.id)}
                          >
                            {isProcessing ? <CircularProgress size={16} /> : <RestoreIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete permanently now">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={isProcessing}
                            onClick={() => permanentlyDelete(task.id)}
                          >
                            <PermDeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
