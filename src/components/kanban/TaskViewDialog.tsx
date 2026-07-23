'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Avatar, Chip,
  IconButton, Tooltip, Divider, CircularProgress, Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  CalendarToday as DateIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon,
  AttachFile as AttachIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  Download as DownloadIcon,
  CheckCircle as AcceptIcon,
  Cancel as RejectIcon,
  Person as PersonIcon,
  Flag as PriorityIcon,
  ViewKanban as ColumnIcon,
  HourglassEmpty as PendingIcon,
  PersonAdd as VolunteerIcon,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { KanbanTask, Profile, KanbanColumn } from '@/types';
import { formatDate, priorityColor } from '@/lib/utils/format';
import { canEditTask as checkCanEditTask, isPersonalBoard } from '@/lib/utils/kanbanScope';

interface Props {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onArchive: (taskId: string) => void;
  onRefresh: () => void;
  task: KanbanTask | null;
  column?: KanbanColumn;
  currentUser: Profile;
}

export default function TaskViewDialog({ open, onClose, onEdit, onArchive, onRefresh, task, column, currentUser }: Props) {
  const [responding, setResponding] = useState<'accepting' | 'rejecting' | null>(null);
  const [volunteering, setVolunteering] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  if (!task) return null;

  const isCreator = task.assignee_id === currentUser.id;

  const allAssignees = task.task_assignees_detail ?? [];
  const myRecord = allAssignees.find((a) => a.user_id === currentUser.id);
  const hasPendingInvitation = myRecord?.status === 'pending';
  const isAcceptedAssignee = myRecord?.status === 'accepted';
  const alreadyInTask = isCreator || !!myRecord;
  const canEdit = checkCanEditTask(currentUser, task.assignee_id, isAcceptedAssignee);
  const canVolunteer = !isPersonalBoard(currentUser) && currentUser.role === 'ojt' && !alreadyInTask;

  const pColor = priorityColor(task.priority);
  const attachments = task.attachments ?? [];

  const fileIcon = (type: string) => {
    if (type === 'image') return <ImageIcon sx={{ fontSize: 18, color: '#6366f1' }} />;
    if (type === 'video') return <VideoIcon sx={{ fontSize: 18, color: '#f59e0b' }} />;
    return <AttachIcon sx={{ fontSize: 18, color: '#64748b' }} />;
  };

  const respondToInvitation = async (status: 'accepted' | 'rejected') => {
    setError('');
    setResponding(status === 'accepted' ? 'accepting' : 'rejecting');
    try {
      const { error: err } = await supabase
        .from('task_assignees')
        .update({ status })
        .eq('task_id', task.id)
        .eq('user_id', currentUser.id);
      if (err) { setError(err.message); return; }
      onRefresh();
      onClose();
    } finally {
      setResponding(null);
    }
  };

  const handleVolunteer = async () => {
    setError('');
    setVolunteering(true);
    try {
      const { error: err } = await supabase
        .from('task_assignees')
        .insert({ task_id: task.id, user_id: currentUser.id, status: 'accepted' });
      if (err) { setError(err.message); return; }
      onRefresh();
      onClose();
    } finally {
      setVolunteering(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      onArchive(task.id);
      onClose();
    } finally {
      setArchiving(false);
    }
  };

  const statusChip = (status: 'pending' | 'accepted' | 'rejected') => {
    const map = {
      pending: { label: 'Pending', color: '#f59e0b', bgcolor: '#fef3c7' },
      accepted: { label: 'Accepted', color: '#22c55e', bgcolor: '#dcfce7' },
      rejected: { label: 'Declined', color: '#ef4444', bgcolor: '#fee2e2' },
    };
    const s = map[status];
    return (
      <Chip
        size="small"
        label={s.label}
        sx={{ bgcolor: s.bgcolor, color: s.color, fontWeight: 600, fontSize: 10, height: 20 }}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ flex: 1, pr: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip
              label={task.priority}
              size="small"
              sx={{
                bgcolor: `${pColor}20`,
                color: pColor,
                fontWeight: 700,
                fontSize: 11,
                height: 22,
                textTransform: 'capitalize',
                borderLeft: `3px solid ${pColor}`,
              }}
            />
            {hasPendingInvitation && (
              <Chip
                icon={<PendingIcon sx={{ fontSize: 13 }} />}
                label="You have been invited"
                size="small"
                sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 600, fontSize: 11, height: 22 }}
              />
            )}
          </Box>
          <Typography variant="h6" fontWeight={700} lineHeight={1.3}>
            {task.title}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ mt: -0.5 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Meta row */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
          {column && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <ColumnIcon sx={{ fontSize: 16, color: column.color }} />
              <Typography variant="body2" color="text.secondary">
                <Box component="span" fontWeight={600} color="text.primary">{column.title}</Box>
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <PriorityIcon sx={{ fontSize: 16, color: pColor }} />
            <Typography variant="body2" color="text.secondary">
              <Box component="span" fontWeight={600} sx={{ color: pColor, textTransform: 'capitalize' }}>{task.priority}</Box>
              {' '}priority
            </Typography>
          </Box>
          {task.due_date && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <DateIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Due <Box component="span" fontWeight={600} color="text.primary">{formatDate(task.due_date)}</Box>
              </Typography>
            </Box>
          )}
        </Box>

        {/* Description */}
        {task.description ? (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={0.75}>Description</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {task.description}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="body2" color="text.disabled" fontStyle="italic">No description provided.</Typography>
          </Box>
        )}

        <Divider sx={{ mb: 2.5 }} />

        {/* Assignees */}
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={1.25}>Assignees</Typography>
          {allAssignees.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {allAssignees.map((a) => (
                <Box key={a.user_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #f1f5f9' }}>
                  <Avatar src={a.profile?.avatar_url} sx={{ width: 32, height: 32, fontSize: 13 }}>
                    {a.profile?.full_name?.charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{a.profile?.full_name}</Typography>
                    {a.profile?.department && (
                      <Typography variant="caption" color="text.secondary">{a.profile.department}</Typography>
                    )}
                  </Box>
                  {statusChip(a.status)}
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
              {task.assignee ? (
                <>
                  <Avatar src={task.assignee.avatar_url} sx={{ width: 32, height: 32 }}>
                    {task.assignee.full_name?.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{task.assignee.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">Creator</Typography>
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">No assignees.</Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Creator */}
        {task.assignee && (
          <>
            <Divider sx={{ mb: 2.5 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">Created by</Typography>
              <Avatar src={task.assignee.avatar_url} sx={{ width: 22, height: 22, fontSize: 10 }}>
                {task.assignee.full_name?.charAt(0)}
              </Avatar>
              <Typography variant="body2" fontWeight={600}>{task.assignee.full_name}</Typography>
            </Box>
          </>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <>
            <Divider sx={{ my: 2.5 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700} mb={1.25}>
                Attachments ({attachments.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {attachments.map((att) => (
                  <Box
                    key={att.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      p: 1.5, bgcolor: '#f8fafc', borderRadius: 2,
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    {att.file_type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.file_url}
                        alt={att.file_name}
                        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      fileIcon(att.file_type)
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap fontWeight={500}>{att.file_name}</Typography>
                    </Box>
                    <Tooltip title="Download / View">
                      <IconButton size="small" href={att.file_url} target="_blank" rel="noopener noreferrer">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        {/* Pending invitation response buttons */}
        {hasPendingInvitation && (
          <>
            <Button
              variant="outlined"
              color="error"
              startIcon={responding === 'rejecting' ? <CircularProgress size={16} /> : <RejectIcon />}
              onClick={() => respondToInvitation('rejected')}
              disabled={!!responding}
            >
              Decline
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={responding === 'accepting' ? <CircularProgress size={16} /> : <AcceptIcon />}
              onClick={() => respondToInvitation('accepted')}
              disabled={!!responding}
            >
              Accept
            </Button>
          </>
        )}

        {/* Volunteer button for OJTs on tasks they haven’t joined */}
        {canVolunteer && (
          <Button
            variant="contained"
            color="primary"
            startIcon={volunteering ? <CircularProgress size={16} color="inherit" /> : <VolunteerIcon />}
            onClick={handleVolunteer}
            disabled={volunteering}
          >
            Join Task
          </Button>
        )}

        {/* Edit button for creator/admin/supervisor/accepted assignee */}
        {canEdit && !hasPendingInvitation && (
          <>
            <Button
              variant="outlined"
              color="warning"
              startIcon={archiving ? <CircularProgress size={16} /> : <ArchiveIcon />}
              onClick={handleArchive}
              disabled={archiving}
            >
              Archive
            </Button>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => { onClose(); onEdit(); }}>
              Edit Task
            </Button>
          </>
        )}

        <Button onClick={onClose} sx={{ ml: 'auto' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
