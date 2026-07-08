'use client';

import React, { useState } from 'react';
import {
  Box, Typography, Button, Card, CardHeader, IconButton,
  Tooltip, Badge, Menu, MenuItem, ListItemIcon,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
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
  onAddTask: () => void;
  onEditColumn: () => void;
  onDeleteColumn: () => void;
  onEditTask: (task: KanbanTask) => void;
  onArchiveTask: (taskId: string) => void;
  onViewTask: (task: KanbanTask) => void;
  onVolunteer?: (taskId: string) => void;
}

export default function KanbanColumnComponent({
  column, canManage, canManageColumns = false, canAddTask = false, isDragging = false, currentUserId, isOjt = false,
  onAddTask, onEditColumn, onDeleteColumn, onEditTask, onArchiveTask, onViewTask, onVolunteer,
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

  return (
    <Box
      ref={setSortableRef}
      style={style}
      sx={{
        width: 320,
        minWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 180px)',
        opacity: isDragging ? 0.8 : 1,
      }}
    >
      <Card
        sx={{
          borderRadius: 3,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: `2px solid ${column.color}30`,
          boxShadow: `0 4px 16px ${column.color}15`,
        }}
      >
        {/* Column Header — draggable */}
        <Box
          {...(canManageColumns ? attributes : {})}
          {...(canManageColumns ? listeners : {})}
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
            <Typography variant="subtitle1" fontWeight={700} noWrap>
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
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canManageColumns && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
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
            '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
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
              // A user is assigned if they are the creator OR an accepted assignee
              const isAssigned = task.assignee_id === currentUserId ||
                (task.task_assignees_detail ?? []).some(
                  (a) => a.user_id === currentUserId && a.status === 'accepted'
                );
              // An OJT can volunteer if they have NO existing row in task_assignees at all
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
                  onEdit={() => onEditTask(task)}
                  onArchive={() => onArchiveTask(task.id)}
                  onView={() => onViewTask(task)}
                  onVolunteer={() => onVolunteer?.(task.id)}
                />
              );
            })}
          </SortableContext>

          {tasks.length === 0 && (
            <Box
              sx={{
                py: 4, textAlign: 'center', border: '2px dashed #e2e8f0',
                borderRadius: 2, color: '#94a3b8',
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
          <Box sx={{ p: 1, borderTop: '1px solid #f1f5f9' }}>
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
        <MenuItem
          onClick={() => { setMenuAnchor(null); onDeleteColumn(); }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          Delete Column
        </MenuItem>
      </Menu>
    </Box>
  );
}
