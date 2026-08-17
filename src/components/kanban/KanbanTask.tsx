'use client';

import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, AvatarGroup,
  Chip, IconButton, Menu, MenuItem, ListItemIcon, Tooltip, Button,
  CircularProgress, Divider,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon,
  AttachFile as AttachIcon,
  CalendarToday as DateIcon,
  HourglassEmpty as PendingIcon,
  PersonAdd as VolunteerIcon,
  TaskAlt as TaskAltIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  DriveFileMove as MoveIcon,
} from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isBefore, startOfDay } from 'date-fns';
import { KanbanTask } from '@/types';
import { formatDate, priorityColor } from '@/lib/utils/format';
import { SHADOWS } from '@/lib/constants/theme';
import { useToast } from '@/lib/context/ToastContext';

interface Props {
  task: KanbanTask;
  canManage?: boolean;
  isDragging?: boolean;
  hasPendingInvitation?: boolean;
  canVolunteer?: boolean;
  availableColumns?: { id: string; title: string }[];
  onEdit?: () => void;
  onArchive?: () => void;
  onView?: () => void;
  onVolunteer?: () => void;
  onMarkAsDone?: () => void;
  onMoveToColumn?: (taskId: string, targetColumnId: string) => void;
  onMoveDirection?: (taskId: string, direction: 'up' | 'down') => void;
}

export default function KanbanTaskCard({
  task,
  canManage = false,
  isDragging = false,
  hasPendingInvitation = false,
  canVolunteer = false,
  availableColumns = [],
  onEdit,
  onArchive,
  onView,
  onVolunteer,
  onMarkAsDone,
  onMoveToColumn,
  onMoveDirection,
}: Props) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [completing, setCompleting] = useState(false);
  const toast = useToast();

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAnchor(null);
    setCompleting(true);
    try {
      const res = await fetch(`/api/kanban/tasks/${task.id}/complete`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete task');
      }
      toast.showSuccess('Task marked as done!');
      onMarkAsDone?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.showError(msg || 'Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortable } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortable ? 0.4 : 1,
  };

  const pColor = priorityColor(task.priority);
  const assignedOjts = task.assigned_ojts ?? [];
  const attachments = task.attachments ?? [];
  const isOverdue = task.due_date ? isBefore(new Date(task.due_date), startOfDay(new Date())) : false;

  return (
    <Box ref={setNodeRef} style={style}>
      <Card
        {...attributes}
        {...listeners}
        onClick={(e) => { e.stopPropagation(); onView?.(); }}
        tabIndex={0}
        aria-roledescription="sortable task"
        sx={{
          borderRadius: 1,
          cursor: isDragging ? 'grabbing' : 'pointer',
          boxShadow: isDragging
            ? SHADOWS.drag
            : SHADOWS.card,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          transition: 'box-shadow 0.2s, transform 0.15s, border-color 0.2s',
          '&:hover': {
            boxShadow: SHADOWS.hover,
            borderColor: 'primary.light',
            transform: 'translateY(-1px)',
          },
          borderLeft: `4px solid ${pColor}`,
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Priority + Menu */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label={task.priority}
                size="small"
                sx={{
                  bgcolor: `${pColor}20`,
                  color: pColor,
                  fontWeight: 600,
                  fontSize: 10,
                  height: 20,
                  textTransform: 'capitalize',
                }}
              />
              {hasPendingInvitation && (
                <Tooltip title="You have been invited to this task">
                  <Chip
                    icon={<PendingIcon sx={{ fontSize: 11 }} />}
                    label="Invited"
                    size="small"
                    color="warning"
                    sx={{ fontWeight: 600, fontSize: 10, height: 20 }}
                  />
                </Tooltip>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title="Mark as Done">
                <span>
                  <IconButton
                    size="small"
                    sx={{ mt: -0.5, color: 'success.main' }}
                    onClick={handleComplete}
                    disabled={completing}
                    aria-label="Mark task as done"
                  >
                    {completing ? <CircularProgress size={16} /> : <TaskAltIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              {canManage && (
                <IconButton
                  size="small"
                  sx={{ mt: -0.5, mr: -0.5 }}
                  onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
                  disabled={completing}
                  aria-label="Task options"
                >
                  <MoreIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* Title */}
          <Typography
            variant="body2"
            fontWeight={600}
            color="text.primary"
            sx={{
              mb: 0.5,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {task.title}
          </Typography>

          {/* Description preview */}
          {task.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                mb: 1,
                lineHeight: 1.5,
              }}
            >
              {task.description}
            </Typography>
          )}

          {/* Due date */}
          {task.due_date && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <DateIcon sx={{ fontSize: 12, color: isOverdue ? 'error.main' : 'text.secondary' }} />
              <Typography
                variant="caption"
                sx={{ color: isOverdue ? 'error.main' : 'text.secondary', fontWeight: isOverdue ? 700 : 400 }}
              >
                {isOverdue ? 'Overdue · ' : ''}{formatDate(task.due_date)}
              </Typography>
            </Box>
          )}

          {/* Footer: assignees + attachments */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5 }}>
            {/* Assigned OJTs */}
            {assignedOjts.length > 0 && (
              <AvatarGroup
                max={4}
                sx={{
                  '& .MuiAvatar-root': {
                    width: 24, height: 24, fontSize: 10, border: '1.5px solid', borderColor: 'background.paper',
                  },
                }}
              >
                {assignedOjts.map((ojt) => {
                  if (!ojt) return null;
                  const name = ojt.full_name || 'Unknown User';
                  return (
                    <Tooltip key={ojt.id} title={name}>
                      <Avatar src={ojt.avatar_url} sx={{ width: 24, height: 24 }}>
                        {name.charAt(0)}
                      </Avatar>
                    </Tooltip>
                  );
                })}
              </AvatarGroup>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
              {/* Volunteer button */}
              {canVolunteer && (
                <Tooltip title="Join this task">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VolunteerIcon sx={{ fontSize: 13 }} />}
                    onClick={(e) => { e.stopPropagation(); onVolunteer?.(); }}
                    sx={{ fontSize: 10, py: 0.25, px: 0.75, minWidth: 0, height: 22, lineHeight: 1 }}
                  >
                    Join
                  </Button>
                </Tooltip>
              )}

              {/* Attachments count */}
              {attachments.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AttachIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">{attachments.length}</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Assigned by */}
          {task.assignee && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <Typography variant="caption" color="text.secondary">by</Typography>
              <Avatar src={task.assignee.avatar_url} sx={{ width: 16, height: 16, fontSize: 8 }}>
                {task.assignee.full_name?.charAt(0)}
              </Avatar>
              <Typography variant="caption" color="text.secondary">{task.assignee.full_name}</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Accessible Context menu for single pointer / keyboard alternatives */}
      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleComplete} sx={{ color: 'success.main', fontWeight: 500 }}>
          <ListItemIcon><TaskAltIcon fontSize="small" color="success" /></ListItemIcon>
          Mark as Done
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); onEdit?.(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          Edit Task
        </MenuItem>

        {/* Accessible reordering alternatives */}
        {onMoveDirection ? [
          <Divider key="move-dir-divider" />,
          <MenuItem key="move-up" onClick={() => { setMenuAnchor(null); onMoveDirection(task.id, 'up'); }}>
            <ListItemIcon><ArrowUpIcon fontSize="small" /></ListItemIcon>
            Move Up
          </MenuItem>,
          <MenuItem key="move-down" onClick={() => { setMenuAnchor(null); onMoveDirection(task.id, 'down'); }}>
            <ListItemIcon><ArrowDownIcon fontSize="small" /></ListItemIcon>
            Move Down
          </MenuItem>,
        ] : null}

        {/* Move to another column */}
        {availableColumns.length > 0 && onMoveToColumn ? [
          <Divider key="move-col-divider" />,
          ...availableColumns.map((col) => (
            <MenuItem
              key={`move-to-${col.id}`}
              onClick={() => {
                setMenuAnchor(null);
                onMoveToColumn(task.id, col.id);
              }}
            >
              <ListItemIcon><MoveIcon fontSize="small" /></ListItemIcon>
              Move to {col.title}
            </MenuItem>
          )),
        ] : null}

        <Divider />
        <MenuItem
          onClick={() => { setMenuAnchor(null); onArchive?.(); }}
          sx={{ color: 'warning.light' }}
        >
          <ListItemIcon><ArchiveIcon fontSize="small" color="warning" /></ListItemIcon>
          Archive Task
        </MenuItem>
      </Menu>
    </Box>
  );
}
