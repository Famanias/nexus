'use client';

import React, { useState } from 'react';
import {
  Box, Typography, Button, Card, IconButton,
  Tooltip, Badge, Menu, MenuItem, ListItemIcon, Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import type { KanbanColumn, KanbanTask } from '@/types';
import KanbanTaskCard from './KanbanTask';

interface Props {
  column: KanbanColumn;
  canManage: boolean;
  canManageColumns?: boolean;
  canAddTask?: boolean;
  isDragging?: boolean;
  currentUserId?: string;
  isOjt?: boolean;
  allColumns?: { id: string; title: string }[];
  columnIndex?: number;
  totalColumns?: number;
  onAddTask: () => void;
  onEditColumn: () => void;
  onDeleteColumn: () => void;
  onMoveColumn?: (columnId: string, direction: 'left' | 'right') => void;
  onMoveTaskToColumn?: (taskId: string, targetColumnId: string) => void;
  onMoveTaskDirection?: (taskId: string, direction: 'up' | 'down') => void;
  onEditTask: (task: KanbanTask) => void;
  onArchiveTask: (taskId: string) => void;
  onViewTask: (task: KanbanTask) => void;
  onVolunteer?: (taskId: string) => void;
  onMarkAsDone: (taskId: string) => void;
}

export default function KanbanColumnComponent({
  column,
  canManage,
  canManageColumns = false,
  canAddTask = false,
  isDragging = false,
  currentUserId,
  isOjt = false,
  allColumns = [],
  columnIndex = 0,
  totalColumns = 1,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  onMoveColumn,
  onMoveTaskToColumn,
  onMoveTaskDirection,
  onEditTask,
  onArchiveTask,
  onViewTask,
  onVolunteer,
  onMarkAsDone,
}: Props) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const {
    attributes, listeners, setNodeRef: setSortableRef,
    transform, transition, isDragging: isSortableDragging,
  } = useSortable({ id: column.id });

  const { setNodeRef: setDroppableRef } = useDroppable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  const tasks = column.tasks ?? [];
  const otherColumns = allColumns.filter((c) => c.id !== column.id);

  return (
    <Box
      ref={setSortableRef}
      style={style}
      sx={{
        width: 320,
        minWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100dvh - 180px)',
        opacity: isDragging ? 0.8 : 1,
      }}
    >
      <Card
        sx={{
          borderRadius: 3,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          border: `2px solid ${column.color}30`,
          boxShadow: `0 4px 16px ${column.color}15`,
        }}
      >
        {/* Column Header — draggable */}
        <Box
          {...(canManageColumns ? attributes : {})}
          {...(canManageColumns ? listeners : {})}
          tabIndex={canManageColumns ? 0 : undefined}
          aria-roledescription={canManageColumns ? 'sortable column' : undefined}
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: '12px 12px 0 0',
            background: `linear-gradient(135deg, ${column.color}22, ${column.color}10)`,
            borderBottom: `2px solid ${column.color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: canManageColumns ? 'grab' : 'default',
            '&:active': { cursor: canManageColumns ? 'grabbing' : 'default' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 12, height: 12, borderRadius: '50%',
                bgcolor: column.color, flexShrink: 0,
              }}
            />
            <Typography variant="subtitle1" fontWeight={700} color="text.primary" noWrap>
              {column.title}
            </Typography>
            <Badge
              badgeContent={tasks.length}
              sx={{
                '& .MuiBadge-badge': {
                  bgcolor: column.color,
                  color: '#fff',
                  fontSize: 10,
                  minWidth: 18,
                  height: 18,
                },
              }}
            >
              <Box />
            </Badge>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {(canManage || canAddTask) && (
              <Tooltip title={canManage ? "Add task" : "Add your task"}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onAddTask(); }}
                  sx={{ color: column.color }}
                  aria-label={`Add task to ${column.title}`}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canManageColumns && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
                aria-label={`Options for column ${column.title}`}
              >
                <MoreIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Tasks area */}
        <Box
          ref={setDroppableRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
          }}
        >
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((task) => {
              const pendingInvite = (task.task_assignees_detail ?? []).some(
                (a) => a.user_id === currentUserId && a.status === 'pending'
              );
              const isAssigned = task.assignee_id === currentUserId ||
                (task.task_assignees_detail ?? []).some(
                  (a) => a.user_id === currentUserId && a.status === 'accepted'
                );
              const alreadyInTask = task.assignee_id === currentUserId ||
                (task.task_assignees_detail ?? []).some((a) => a.user_id === currentUserId);
              const canVolunteer = isOjt && !alreadyInTask;
              const canEditTask = canManage || isAssigned;
              return (
                <KanbanTaskCard
                  key={task.id}
                  task={task}
                  canManage={canEditTask}
                  canVolunteer={canVolunteer}
                  hasPendingInvitation={pendingInvite}
                  availableColumns={otherColumns}
                  onEdit={() => onEditTask(task)}
                  onArchive={() => onArchiveTask(task.id)}
                  onView={() => onViewTask(task)}
                  onVolunteer={() => onVolunteer?.(task.id)}
                  onMarkAsDone={() => onMarkAsDone(task.id)}
                  onMoveToColumn={onMoveTaskToColumn}
                  onMoveDirection={onMoveTaskDirection}
                />
              );
            })}
          </SortableContext>

          {tasks.length === 0 && (
            <Box
              sx={{
                py: 4, textAlign: 'center', border: '2px dashed',
                borderColor: 'divider', borderRadius: 2, color: 'text.secondary',
              }}
            >
              <Typography variant="body2">No tasks yet</Typography>
              {(canManage || canAddTask) && (
                <Button size="small" startIcon={<AddIcon />} onClick={onAddTask} sx={{ mt: 1 }}>
                  Add Task
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* Footer Add Button */}
        {(canManage || canAddTask) && tasks.length > 0 && (
          <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              fullWidth size="small" startIcon={<AddIcon />}
              onClick={onAddTask}
              sx={{ color: 'text.secondary', justifyContent: 'flex-start', borderRadius: 2 }}
            >
              Add task
            </Button>
          </Box>
        )}
      </Card>

      {/* Column menu */}
      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { setMenuAnchor(null); onEditColumn(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          Edit Column
        </MenuItem>

        {/* Accessible column movement */}
        {canManageColumns && onMoveColumn && totalColumns > 1 ? [
          <Divider key="move-col-divider" />,
          <MenuItem
            key="move-col-left"
            disabled={columnIndex === 0}
            onClick={() => {
              setMenuAnchor(null);
              onMoveColumn(column.id, 'left');
            }}
          >
            <ListItemIcon><ArrowBackIcon fontSize="small" /></ListItemIcon>
            Move Left
          </MenuItem>,
          <MenuItem
            key="move-col-right"
            disabled={columnIndex === totalColumns - 1}
            onClick={() => {
              setMenuAnchor(null);
              onMoveColumn(column.id, 'right');
            }}
          >
            <ListItemIcon><ArrowForwardIcon fontSize="small" /></ListItemIcon>
            Move Right
          </MenuItem>,
        ] : null}

        <Divider />
        <MenuItem
          onClick={() => { setMenuAnchor(null); onDeleteColumn(); }}
          sx={{ color: 'error.light' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          Delete Column
        </MenuItem>
      </Menu>
    </Box>
  );
}
