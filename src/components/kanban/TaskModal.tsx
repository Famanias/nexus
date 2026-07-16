'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, FormControl, InputLabel, Select,
  MenuItem, CircularProgress, Typography, Box, Avatar,
  Checkbox, ListItemText, OutlinedInput, Chip, Alert,
  IconButton, Tooltip, Divider, LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  AttachFile as AttachIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@/lib/supabase/client';
import { uploadTaskAttachment, deleteTaskAttachments } from '@/actions/attachments';
import { KanbanTask, KanbanColumn, Profile, TaskAttachment } from '@/types';
import { isPersonalBoard, canAssignUsers } from '@/lib/utils/kanbanScope';
import { getFileType, formatFileSize, priorityColor } from '@/lib/utils/format';
import { v4 as uuidv4 } from 'uuid';
import { emitClientEvent } from '@/lib/automation/client-emitter';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editingTask: KanbanTask | null;
  defaultColumnId: string;
  columns: KanbanColumn[];
  ojts: Profile[];
  currentUser: Profile | null;
}

const PRIORITIES = ['low', 'medium', 'high'];

type UploadStatus = 'uploading' | 'done' | 'error';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string;
  // set once upload completes
  uploadedPath?: string;
  // local blob URL for instant preview (images only)
  previewUrl?: string;
}

export default function TaskModal({
  open, onClose, onSave, editingTask, defaultColumnId, columns, ojts, currentUser,
}: Props) {
  const showAssignee = canAssignUsers(currentUser);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [assignedOjtIds, setAssignedOjtIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [existingAttachments, setExistingAttachments] = useState<TaskAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      // Revoke any previous blob URLs then reset
      setUploadingFiles((prev) => {
        prev.forEach((u) => { if (u.previewUrl) URL.revokeObjectURL(u.previewUrl); });
        return [];
      });
      if (editingTask) {
        setTitle(editingTask.title);
        setDescription(editingTask.description ?? '');
        setColumnId(editingTask.column_id);
        setAssignedOjtIds((editingTask.assigned_ojts ?? []).filter(Boolean).map((o) => o?.id).filter(Boolean));
        setPriority(editingTask.priority);
        setDueDate(editingTask.due_date ?? '');
        setExistingAttachments(editingTask.attachments ?? []);
      } else {
        setTitle('');
        setDescription('');
        setColumnId(defaultColumnId);
        setAssignedOjtIds([]);
        setPriority('medium');
        setDueDate('');
        setExistingAttachments([]);
      }
      setError('');

    }
  }, [open, editingTask, defaultColumnId]);

  // Upload via server action (service-role key) — bypasses bucket RLS entirely.
  const uploadFileNow = useCallback(async (uploadId: string, file: File) => {
    const update = (patch: Partial<UploadingFile>) =>
      setUploadingFiles((prev) =>
        prev.map((u) => (u.id === uploadId ? { ...u, ...patch } : u))
      );

    const fd = new FormData();
    fd.append('file', file);
    const result = await uploadTaskAttachment(fd);

    if (result.error || !result.path) {
      update({ status: 'error', error: result.error ?? 'Upload failed' });
    } else {
      update({ status: 'done', progress: 100, uploadedPath: result.path });
    }
  }, []);

  const handleSave = async () => {
    if (!title.trim()) { setError('Task title is required.'); return; }
    const isOjt = currentUser?.role === 'ojt';
    // Admins/supervisors must assign at least one OJT; OJTs are auto-assigned to themselves. Skip in Personal Mode.
    if (showAssignee && !isOjt && assignedOjtIds.length === 0) { setError('Please assign at least one OJT.'); return; }
    setSaving(true);
    setError('');

    let taskId = editingTask?.id;

    if (editingTask) {
      const { error: updateError } = await supabase
        .from('kanban_tasks')
        .update({
          title: title.trim(),
          description: description || null,
          column_id: columnId,
          priority,
          due_date: dueDate || null,
        })
        .eq('id', editingTask.id);
      if (updateError) { setError(updateError.message); setSaving(false); return; }

      // Sync assignees
      await supabase.from('task_assignees').delete().eq('task_id', editingTask.id);
    } else {
      const { data: newTask, error: insertError } = await supabase
        .from('kanban_tasks')
        .insert({
          column_id: columnId,
          title: title.trim(),
          description: description || null,
          assignee_id: currentUser?.id,
          priority,
          due_date: dueDate || null,
          position: columns.find((c) => c.id === columnId)?.tasks?.length ?? 0,
        })
        .select()
        .single();

      if (insertError || !newTask) { setError(insertError?.message ?? 'Failed to create task'); setSaving(false); return; }
      taskId = newTask.id;
    }

    // Insert task assignees
    // OJT creator is always accepted; others they invite are pending
    const isOjtCreator = currentUser?.role === 'ojt';
    const assigneesToInsert: { task_id: string; user_id: string; status: string }[] = [];

    if (isOjtCreator && currentUser) {
      // Auto-add self as accepted
      if (!assignedOjtIds.includes(currentUser.id)) {
        assigneesToInsert.push({ task_id: taskId!, user_id: currentUser.id, status: 'accepted' });
      }
    }

    assignedOjtIds.forEach((uid) => {
      assigneesToInsert.push({
        task_id: taskId!,
        user_id: uid,
        // OJT creator inviting others → pending; admin/supervisor assigning → accepted
        status: isOjtCreator && uid !== currentUser?.id ? 'pending' : 'accepted',
      });
    });

    if (assigneesToInsert.length > 0) {
      await supabase.from('task_assignees').insert(assigneesToInsert);
    }

    // Emit automation events (wait for them to finish sending to prevent aborted fetches on unmount)
    if (taskId) {
      if (!editingTask) {
        // task.created event
        await emitClientEvent('task.created', {
          taskId,
          title: title.trim(),
          description: description || undefined,
          columnId,
          priority,
          creatorId: currentUser?.id,
          creatorName: currentUser?.full_name,
          assigneeIds: assignedOjtIds,
        });
      }

      // Determine which assignees are new so we don't spam people who were already assigned
      const oldAssigneeIds = editingTask 
        ? (editingTask.assigned_ojts ?? []).filter(Boolean).map((o) => o?.id).filter(Boolean)
        : [];
      const newAssigneeIds = assignedOjtIds.filter(id => !oldAssigneeIds.includes(id));

      // task.assigned events for each newly assigned user
      for (const uid of newAssigneeIds) {
        const ojt = ojts.find((o) => o.id === uid);
        if (ojt) {
          await emitClientEvent('task.assigned', {
            taskId,
            title: title.trim(),
            assigneeId: uid,
            assigneeName: ojt.full_name,
            assigneeEmail: ojt.email,
            assignedBy: currentUser?.id,
            assignedByName: currentUser?.full_name,
          });
        }
      }
    }

    // Wait for any still-uploading files to finish
    const stillUploading = uploadingFiles.filter((u) => u.status === 'uploading');
    if (stillUploading.length > 0) {
      setError('Please wait for all files to finish uploading.');
      setSaving(false);
      return;
    }

    // Insert DB records for all successfully uploaded files.
    // file_url stores the proxy path so we can generate signed URLs on demand.
    const done = uploadingFiles.filter((u) => u.status === 'done' && u.uploadedPath);
    if (done.length > 0) {
      await supabase.from('task_attachments').insert(
        done.map((u) => ({
          task_id: taskId!,
          file_name: u.file.name,
          file_url: `/api/task-attachment?path=${encodeURIComponent(u.uploadedPath!)}`,
          file_type: getFileType(u.file.type),
          file_size: u.file.size,
          uploaded_by: currentUser?.id,
        }))
      );
    }

    setSaving(false);
    onSave();
  };

  // On cancel: delete any files that were uploaded to storage but not saved to the DB
  const handleClose = useCallback(async () => {
    const paths = uploadingFiles
      .filter((u) => u.uploadedPath)
      .map((u) => u.uploadedPath!);
    if (paths.length) await deleteTaskAttachments(paths);
    // Revoke blob preview URLs
    uploadingFiles.forEach((u) => { if (u.previewUrl) URL.revokeObjectURL(u.previewUrl); });
    onClose();
  }, [uploadingFiles, onClose]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads: UploadingFile[] = acceptedFiles.map((file) => ({
      id: uuidv4(),
      file,
      progress: 0,
      status: 'uploading' as UploadStatus,
      // Instant local preview for images — no network needed
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setUploadingFiles((prev) => [...prev, ...newUploads]);
    // Start uploading immediately — don't wait for Save
    newUploads.forEach((u) => uploadFileNow(u.id, u.file));
  }, [uploadFileNow]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'video/*': [],
      'application/pdf': [],
      'application/msword': [],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
      'application/vnd.ms-excel': [],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const removeUploadingFile = async (id: string) => {
    const file = uploadingFiles.find((u) => u.id === id);
    if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
    // Delete from storage via server action (service role)
    if (file?.uploadedPath) await deleteTaskAttachments([file.uploadedPath]);
    setUploadingFiles((prev) => prev.filter((u) => u.id !== id));
  };

  const deleteAttachment = async (attachmentId: string, fileUrl: string) => {
    await supabase.from('task_attachments').delete().eq('id', attachmentId);
    // Extract storage path from our proxy URL format: /api/task-attachment?path=...
    try {
      const url = new URL(fileUrl, window.location.origin);
      const path = url.searchParams.get('path');
      if (path) await deleteTaskAttachments([path]);
    } catch { /* ignore malformed URLs */ }
    setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const fileIcon = (type: string) => {
    if (type === 'image') return <ImageIcon sx={{ fontSize: 18, color: '#6366f1' }} />;
    if (type === 'video') return <VideoIcon sx={{ fontSize: 18, color: '#f59e0b' }} />;
    return <AttachIcon sx={{ fontSize: 18, color: '#64748b' }} />;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" fontWeight={700} component="span">
          {editingTask ? 'Edit Task' : 'New Task'}
        </Typography>
        <IconButton onClick={handleClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2.5}>
          {/* Title */}
          <Grid size={12}>
            <TextField
              fullWidth label="Task Title *" value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </Grid>

          {/* Column + Priority */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Column</InputLabel>
              <Select value={columnId} label="Column" onChange={(e) => setColumnId(e.target.value)}>
                {columns.map((col) => (
                  <MenuItem key={col.id} value={col.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: col.color }} />
                      {col.title}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select value={priority} label="Priority" onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}>
                {PRIORITIES.map((p) => (
                  <MenuItem key={p} value={p}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: priorityColor(p) }} />
                      <Typography sx={{ textTransform: 'capitalize' }}>{p}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Description */}
          <Grid size={12}>
            <TextField
              fullWidth label="Description" value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline rows={3}
              placeholder="Add task details..."
            />
          </Grid>

          {/* Assigned OJTs */}
          {showAssignee && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required={currentUser?.role !== 'ojt'}>
                <InputLabel>
                  {currentUser?.role === 'ojt' ? 'Invite Other OJTs (optional)' : 'Assigned OJTs *'}
                </InputLabel>
                <Select
                  multiple
                  value={assignedOjtIds}
                  onChange={(e) => setAssignedOjtIds(e.target.value as string[])}
                  input={<OutlinedInput label={currentUser?.role === 'ojt' ? 'Invite Other OJTs (optional)' : 'Assigned OJTs *'} />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((id) => {
                        const ojt = ojts.find((o) => o.id === id);
                        return (
                          <Chip
                            key={id}
                            size="small"
                            avatar={<Avatar src={ojt?.avatar_url}>{ojt?.full_name.charAt(0)}</Avatar>}
                            label={ojt?.full_name ?? id}
                          />
                        );
                      })}
                    </Box>
                  )}
                >
                  {ojts
                    .filter((o) => o.id !== currentUser?.id)
                    .map((ojt) => (
                    <MenuItem key={ojt.id} value={ojt.id}>
                      <Checkbox checked={assignedOjtIds.includes(ojt.id)} />
                      <Avatar src={ojt.avatar_url} sx={{ width: 24, height: 24, mr: 1 }}>
                        {ojt.full_name.charAt(0)}
                      </Avatar>
                      <ListItemText
                        primary={ojt.full_name}
                        secondary={currentUser?.role === 'ojt' ? `Will be invited` : ojt.department}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          {/* Due Date */}
          <Grid size={{ xs: 12, sm: showAssignee ? 6 : 12 }}>
            <TextField
              fullWidth label="Due Date" type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* Assignee (auto-set, display only) */}
          {currentUser && (
            <Grid size={12}>
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  p: 1.5, bgcolor: '#f8fafc', borderRadius: 2,
                  border: '1px solid #e2e8f0',
                }}
              >
                <Avatar src={currentUser.avatar_url} sx={{ width: 32, height: 32 }}>
                  {currentUser.full_name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{currentUser.full_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentUser.role === 'ojt' ? 'Task creator (auto-assigned as accepted)' : 'Task creator (auto-set)'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}

          {/* Attachments */}
          <Grid size={12}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
              Attachments
            </Typography>

            {/* Existing attachments */}
            {existingAttachments.length > 0 && (
              <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {existingAttachments.map((att) => (
                  <Box
                    key={att.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      p: 1.5, bg: '#f8fafc', borderRadius: 1.5,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {fileIcon(att.file_type)}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap fontWeight={500}>{att.file_name}</Typography>
                      {att.file_size && (
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(att.file_size)}
                        </Typography>
                      )}
                    </Box>
                    <Tooltip title="Download">
                      <IconButton size="small" href={att.file_url} target="_blank" rel="noopener noreferrer">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => deleteAttachment(att.id, att.file_url)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )}

            {/* New uploads */}
            {uploadingFiles.length > 0 && (
              <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {uploadingFiles.map((upload) => (
                  <Box
                    key={upload.id}
                    sx={{
                      p: 1.5, borderRadius: 1.5, border: '1px solid #e2e8f0',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: upload.status !== 'error' ? 0.5 : 0 }}>
                      {/* Image preview thumbnail */}
                      {upload.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={upload.previewUrl}
                          alt={upload.file.name}
                          style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                        />
                      ) : (
                        fileIcon(getFileType(upload.file.type))
                      )}
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>{upload.file.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(upload.file.size)}
                      </Typography>
                      <IconButton size="small" onClick={() => removeUploadingFile(upload.id)}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    {upload.status === 'error' ? (
                      <Typography variant="caption" color="error">{upload.error}</Typography>
                    ) : upload.status === 'done' ? (
                      <LinearProgress variant="determinate" value={100} color="success" sx={{ height: 4, borderRadius: 2 }} />
                    ) : (
                      <LinearProgress variant="indeterminate" sx={{ height: 4, borderRadius: 2 }} />
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* Dropzone */}
            <Box
              {...getRootProps()}
              sx={{
                border: `2px dashed ${isDragActive ? '#6366f1' : '#e2e8f0'}`,
                borderRadius: 2, p: 3, textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                bgcolor: isDragActive ? '#6366f108' : '#fafafa',
                '&:hover': { borderColor: '#6366f1', bgcolor: '#6366f108' },
              }}
            >
              <input {...getInputProps()} />
              <AttachIcon sx={{ color: '#94a3b8', fontSize: 32, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Supports images, videos, PDFs, Word, Excel — max 50MB each
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {editingTask ? 'Save Changes' : 'Create Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
