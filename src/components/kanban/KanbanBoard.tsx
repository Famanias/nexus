'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor,
  useSensor, useSensors, DragStartEvent, DragOverEvent, DragEndEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Box, Button, Typography, CircularProgress, Alert, Badge,
  Autocomplete, TextField, Chip, Tooltip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, RadioGroup, FormControlLabel, Radio, Select, MenuItem, InputLabel,
} from '@mui/material';
import {
  Add as AddIcon, HourglassEmpty as PendingIcon,
  FilterList as FilterIcon,
  Archive as ArchiveIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { KanbanColumn, KanbanTask, Profile } from '@/types';
import KanbanColumnComponent from './KanbanColumn';
import KanbanTaskCard from './KanbanTask';
import TaskModal from './TaskModal';
import ColumnDialog from './ColumnDialog';
import TaskViewDialog from './TaskViewDialog';
import TaskArchiveDialog from './TaskArchiveDialog';

interface Props {
  initialColumns: KanbanColumn[];
  initialOjts: Profile[];
  initialProfile: Profile;
}

export default function KanbanBoard({ initialColumns, initialOjts, initialProfile }: Props) {
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns);
  const [allOjts, setAllOjts] = useState<Profile[]>(initialOjts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [activeColumn, setActiveColumn] = useState<KanbanColumn | null>(null);
  const [viewingTask, setViewingTask] = useState<KanbanTask | null>(null);
  const [filterOjtIds, setFilterOjtIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteColConfirm, setDeleteColConfirm] = useState<KanbanColumn | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<string>('');
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const [deleteColAction, setDeleteColAction] = useState<'move' | 'archive'>('archive');
  const [deleteColMoveTarget, setDeleteColMoveTarget] = useState<string>('');
  const dragStartColumnsRef = React.useRef<KanbanColumn[]>([]);
  const supabase = createClient();
  const profile = initialProfile;

  const canManage = profile?.role === 'admin' || profile?.role === 'supervisor';
  const canManageColumns = !!profile?.org_id;
  const isOjt = profile?.role === 'ojt';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  type RawAssignee = { user_id: string; status?: string; profile: Profile };

  const buildEnrichedCols = (cols: KanbanColumn[], tasks: KanbanTask[]) =>
    (cols ?? []).map((col) => ({
      ...col,
      tasks: (tasks ?? [])
        .filter((t: KanbanTask) => t.column_id === col.id)
        .map((t: KanbanTask & { task_assignees_raw?: RawAssignee[] }) => {
          const raw: RawAssignee[] = t.task_assignees_raw ?? [];
          const detail = raw.map((a) => ({
            user_id: a.user_id,
            status: (a.status ?? 'accepted') as 'pending' | 'accepted' | 'rejected',
            profile: a.profile,
          }));
          return {
            ...t,
            task_assignees_detail: detail,
            assigned_ojts: detail
              .filter((a) => a.status === 'accepted')
              .map((a) => a.profile),
          };
        }),
    }));

  const fetchBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    const taskQuery = `
      *,
      assignee:profiles!kanban_tasks_assignee_id_fkey(id, full_name, avatar_url, role),
      task_assignees_raw:task_assignees(
        user_id,
        status,
        profile:profiles(id, full_name, avatar_url, department)
      ),
      attachments:task_attachments(*)
    `;

    const taskQueryFallback = `
      *,
      assignee:profiles!kanban_tasks_assignee_id_fkey(id, full_name, avatar_url, role),
      task_assignees_raw:task_assignees(
        user_id,
        profile:profiles(id, full_name, avatar_url, department)
      ),
      attachments:task_attachments(*)
    `;

    const [{ data: cols, error: colError }, tasksRes, { data: ojts }] =
      await Promise.all([
        supabase.from('kanban_columns').select('*').order('position'),
        supabase.from('kanban_tasks').select(taskQuery).order('position').is('archived_at', null),
        supabase.from('profiles').select('*').eq('role', 'ojt').eq('is_active', true),
      ]);

    if (colError) { setError(colError.message); setLoading(false); setIsRefreshing(false); return; }

    // Fallback if status column doesn't exist yet in DB
    let tasks = tasksRes.data;
    if (tasksRes.error) {
      const fallback = await supabase.from('kanban_tasks').select(taskQueryFallback).order('position').is('archived_at', null);
      tasks = fallback.data;
      if (fallback.error) setError(fallback.error.message);
    }

    setAllOjts(ojts ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setColumns(buildEnrichedCols(cols ?? [], tasks as any ?? []));
    setLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => { fetchBoard(false); }, [fetchBoard]);

  // ---- DnD Handlers ----

  const findTaskById = (taskId: string): KanbanTask | undefined => {
    for (const col of columns) {
      const t = col.tasks?.find((t) => t.id === taskId);
      if (t) return t;
    }
    return undefined;
  };

  const isAssignedToTask = (task: KanbanTask): boolean =>
    task.assignee_id === profile.id ||
    (task.task_assignees_detail ?? []).some(
      (a) => a.user_id === profile.id && a.status === 'accepted'
    );

  const onDragStart = (event: DragStartEvent) => {
    // Deep copy of the columns and task arrays to allow clean rollbacks
    dragStartColumnsRef.current = columns.map(c => ({
      ...c,
      tasks: [...(c.tasks || [])]
    }));

    const { active } = event;
    const id = active.id as string;

    const col = columns.find((c) => c.id === id);
    if (col) {
      // OJTs cannot reorder columns
      if (isOjt) return;
      setActiveColumn(col); return;
    }

    for (const col of columns) {
      const task = col.tasks?.find((t) => t.id === id);
      if (task) {
        // OJTs can only drag tasks they are assigned to
        if (isOjt && !isAssignedToTask(task)) return;
        setActiveTask(task); return;
      }
    }
  };

  const findColumnOfTask = (taskId: string) =>
    columns.find((col) => col.tasks?.some((t) => t.id === taskId));

  const volunteerForTask = async (taskId: string) => {
    const { error: err } = await supabase
      .from('task_assignees')
      .insert({ task_id: taskId, user_id: profile.id, status: 'accepted' });
    if (!err) fetchBoard(true);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveTask = !columns.find((c) => c.id === activeId);
    const isOverColumn = !!columns.find((c) => c.id === overId);

    if (!isActiveTask) return;

    setColumns((prev) => {
      const activeCol = prev.find((c) => c.tasks?.some((t) => t.id === activeId));
      const overCol = isOverColumn
        ? prev.find((c) => c.id === overId)
        : prev.find((c) => c.tasks?.some((t) => t.id === overId));

      if (!activeCol || !overCol || activeCol.id === overCol.id) return prev;

      const activeTask = activeCol.tasks?.find((t) => t.id === activeId)!;
      const overTaskIndex = overCol.tasks?.findIndex((t) => t.id === overId) ?? overCol.tasks?.length ?? 0;

      return prev.map((col) => {
        if (col.id === activeCol.id) {
          return { ...col, tasks: col.tasks?.filter((t) => t.id !== activeId) };
        }
        if (col.id === overCol.id) {
          const newTasks = [...(col.tasks ?? [])];
          newTasks.splice(isOverColumn ? newTasks.length : overTaskIndex, 0, {
            ...activeTask,
            column_id: overCol.id,
          });
          return { ...col, tasks: newTasks };
        }
        return col;
      });
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveColumn(null);
    
    if (!over) {
      // Drop cancelled/outside -> rollback UI state
      setColumns(dragStartColumnsRef.current);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Column reorder
    const isActiveCol = !!columns.find((c) => c.id === activeId);
    if (isActiveCol && activeId !== overId) {
      if (!canManageColumns) {
        setColumns(dragStartColumnsRef.current);
        return;
      }
      const oldIndex = columns.findIndex((c) => c.id === activeId);
      const newIndex = columns.findIndex((c) => c.id === overId);
      const newCols = arrayMove(columns, oldIndex, newIndex);
      
      // Optimistic update
      setColumns(newCols);

      try {
        const payload = newCols.map((col, i) => ({
          id: col.id,
          position: i,
        }));
        
        const res = await fetch('/api/kanban/reorder/columns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error('Failed to persist column reorder.');
        fetchBoard(true); // Sync with DB
      } catch (err) {
        console.error(err);
        setColumns(dragStartColumnsRef.current);
        setError('Failed to save column order. Order has been rolled back.');
      }
      return;
    }

    // Task reorder / move
    const activeCol = dragStartColumnsRef.current.find((c) => c.tasks?.some((t) => t.id === activeId));
    const overCol =
      columns.find((c) => c.id === overId) ||
      columns.find((c) => c.tasks?.some((t) => t.id === overId));

    if (!activeCol || !overCol) return;

    if (activeCol.id === overCol.id) {
      // Same-column reorder
      const oldIdx = activeCol.tasks?.findIndex((t) => t.id === activeId) ?? 0;
      const newIdx = activeCol.tasks?.findIndex((t) => t.id === overId) ?? 0;
      if (oldIdx === newIdx) return;

      const newTasks = arrayMove(activeCol.tasks ?? [], oldIdx, newIdx);
      
      // Optimistic update
      const updatedCols = columns.map((c) => (c.id === activeCol.id ? { ...c, tasks: newTasks } : c));
      setColumns(updatedCols);

      try {
        const payload = {
          tasks: newTasks.map((t, i) => ({
            id: t.id,
            column_id: activeCol.id,
            position: i,
          })),
        };

        const res = await fetch('/api/kanban/reorder/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error('Failed to persist task reorder.');
        fetchBoard(true); // Sync with DB
      } catch (err) {
        console.error(err);
        setColumns(dragStartColumnsRef.current);
        setError('Failed to save task order. Order has been rolled back.');
      }
    } else {
      // Cross-column move - visual state already handled by onDragOver
      // Destination column from the CURRENT state (contains the dragged task)
      const destCol = columns.find((c) => c.id === overCol.id);
      if (!destCol) return;

      try {
        const sourceTasks = activeCol.tasks?.filter((t) => t.id !== activeId) || [];
        const destTasks = destCol.tasks || [];

        const payloadTasks = [
          ...sourceTasks.map((t, i) => ({
            id: t.id,
            column_id: activeCol.id,
            position: i,
          })),
          ...destTasks.map((t, i) => ({
            id: t.id,
            column_id: overCol.id,
            position: i,
          })),
        ];

        const res = await fetch('/api/kanban/reorder/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: payloadTasks }),
        });

        if (!res.ok) throw new Error('Failed to persist cross-column task movement.');
        fetchBoard(true); // Sync with DB
      } catch (err) {
        console.error(err);
        setColumns(dragStartColumnsRef.current);
        setError('Failed to save task move. Board has been rolled back.');
      }
    }
  };

  const openCreateTask = (columnId: string) => {
    setDefaultColumnId(columnId);
    setEditingTask(null);
    setViewingTask(null);
    setTaskModalOpen(true);
  };

  const openEditTask = (task: KanbanTask) => {
    setEditingTask(task);
    setViewingTask(null);
    setTaskModalOpen(true);
  };

  const openViewTask = (task: KanbanTask) => {
    setViewingTask(task);
  };

  const archiveTask = async (taskId: string) => {
    await supabase
      .from('kanban_tasks')
      .update({ archived_at: new Date().toISOString(), archived_by: profile.id })
      .eq('id', taskId);
    fetchBoard(true);
  };

  // Columns with filter applied (admin/supervisor only)
  const displayedColumns = filterOjtIds.length === 0
    ? columns
    : columns.map((col) => ({
        ...col,
        tasks: (col.tasks ?? []).filter((t) => {
          const acceptedIds = [
            ...(t.assignee_id ? [t.assignee_id] : []),
            ...(t.task_assignees_detail ?? [])
              .filter((a) => a.status === 'accepted')
              .map((a) => a.user_id),
          ];
          return filterOjtIds.some((id) => acceptedIds.includes(id));
        }),
      }));

  const openCreateColumn = () => {
    setEditingColumn(null);
    setColumnDialogOpen(true);
  };

  const openEditColumn = (col: KanbanColumn) => {
    setEditingColumn(col);
    setColumnDialogOpen(true);
  };

  const deleteColumn = async (col: KanbanColumn) => {
    setDeleteColConfirm(col);
  };

  const handleSaveColumn = async (title: string, color: string) => {
    const originalColumns = [...columns];

    if (editingColumn) {
      // Optimistic update for editing
      const updatedCols = columns.map((c) =>
        c.id === editingColumn.id ? { ...c, title, color } : c
      );
      setColumns(updatedCols);

      try {
        const res = await fetch(`/api/kanban/columns/${editingColumn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, color }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? 'Failed to update column.');
        }
        fetchBoard(true); // Silent reload
      } catch (err: any) {
        setColumns(originalColumns);
        throw err;
      }
    } else {
      // Optimistic update for creating
      const tempId = `temp-${Date.now()}`;
      const newCol: KanbanColumn = {
        id: tempId,
        title,
        color,
        position: columns.length,
        tasks: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setColumns([...columns, newCol]);

      try {
        const res = await fetch('/api/kanban/columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, color }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? 'Failed to create column.');
        }
        const createdCol = await res.json();
        
        // Replace temp ID with database-persisted record
        setColumns((prev) =>
          prev.map((c) => (c.id === tempId ? { ...createdCol, tasks: [] } : c))
        );
        fetchBoard(true); // Silent reload
      } catch (err: any) {
        setColumns(originalColumns);
        throw err;
      }
    }
  };

  const confirmDeleteColumn = async () => {
    if (!deleteColConfirm) return;
    const colId = deleteColConfirm.id;
    const tasksCount = columns.find((c) => c.id === colId)?.tasks?.length ?? 0;

    const moveTasksTo = (tasksCount > 0 && deleteColAction === 'move')
      ? deleteColMoveTarget || null
      : null;

    try {
      const res = await fetch(`/api/kanban/columns/${colId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveTasksTo }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Failed to delete column.');
      }

      setDeleteColConfirm(null);
      setDeleteColMoveTarget('');
      setDeleteColAction('archive');
      fetchBoard(true);
    } catch (err: any) {
      alert(err.message ?? 'An error occurred during column deletion.');
    }
  };

  if (loading && columns.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Loading board...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Kanban Board</Typography>
            <Typography color="text.secondary">Manage and track OJT tasks</Typography>
          </Box>
          {isRefreshing && <CircularProgress size={20} sx={{ ml: 1 }} />}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isOjt && (() => {
            const pendingCount = columns
              .flatMap((c) => c.tasks ?? [])
              .filter((t) =>
                (t.task_assignees_detail ?? []).some(
                  (a) => a.user_id === profile.id && a.status === 'pending'
                )
              ).length;
            return pendingCount > 0 ? (
              <Badge badgeContent={pendingCount} color="warning">
                <Button variant="outlined" startIcon={<PendingIcon />} color="warning"
                  onClick={() => {
                    const firstPending = columns
                      .flatMap((c) => c.tasks ?? [])
                      .find((t) => (t.task_assignees_detail ?? []).some(
                        (a) => a.user_id === profile.id && a.status === 'pending'
                      ));
                    if (firstPending) openViewTask(firstPending);
                  }}
                >
                  Invitations
                </Button>
              </Badge>
            ) : null;
          })()}
          {profile.role === 'admin' && (
            <Button
              variant="outlined"
              startIcon={<ArchiveIcon />}
              onClick={() => setArchiveDialogOpen(true)}
              color="inherit"
            >
              Archives
            </Button>
          )}
          {canManageColumns && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreateColumn}>
              Add Column
            </Button>
          )}
        </Box>
      </Box>

      {/* Filter bar — admin/supervisor only */}
      {canManage && allOjts.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FilterIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
          <Autocomplete
            multiple
            size="small"
            options={allOjts}
            getOptionLabel={(o) => o.full_name}
            value={allOjts.filter((o) => filterOjtIds.includes(o.id))}
            onChange={(_, val) => setFilterOjtIds(val.map((o) => o.id))}
            sx={{ minWidth: 320, maxWidth: 520 }}
            renderInput={(params) => (
              <TextField {...params} placeholder="Filter by OJT(s)…" label="Filter tasks" />
            )}
            renderTags={(val, getTagProps) =>
              val.map((o, i) => (
                <Chip
                  {...getTagProps({ index: i })}
                  key={o.id}
                  size="small"
                  avatar={<Avatar src={o.avatar_url}>{o.full_name.charAt(0)}</Avatar>}
                  label={o.full_name}
                />
              ))
            }
          />
          {filterOjtIds.length > 0 && (
            <Tooltip title="Clear filter">
              <Button size="small" onClick={() => setFilterOjtIds([])} color="inherit">
                Clear
              </Button>
            </Tooltip>
          )}
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                overflowX: 'auto',
                height: '100%',
                pb: 2,
                alignItems: 'flex-start',
                '&::-webkit-scrollbar': { height: 8 },
                '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 4 },
              }}
            >
              {displayedColumns.map((col) => (
                <KanbanColumnComponent
                  key={col.id}
                  column={col}
                  canManage={canManage}
                  canManageColumns={canManageColumns}
                  canAddTask={true}
                  currentUserId={profile.id}
                  isOjt={isOjt}
                  onAddTask={() => openCreateTask(col.id)}
                  onEditColumn={() => openEditColumn(col)}
                  onDeleteColumn={() => deleteColumn(col)}
                  onEditTask={openEditTask}
                  onArchiveTask={archiveTask}
                  onViewTask={openViewTask}
                  onVolunteer={volunteerForTask}
                />
              ))}

              {/* Add Column button at the end of the board */}
              {canManageColumns && (
                <Box
                  onClick={openCreateColumn}
                  sx={{
                    width: 320,
                    minWidth: 320,
                    height: 120,
                    borderRadius: 3,
                    border: '2px dashed #cbd5e1',
                    bgcolor: 'rgba(255, 255, 255, 0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    gap: 1,
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(99, 102, 241, 0.05)',
                      borderColor: 'primary.main',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                    },
                  }}
                >
                  <AddIcon color="primary" />
                  <Typography variant="subtitle2" fontWeight={600} color="primary">
                    Add Column
                  </Typography>
                </Box>
              )}
            </Box>
          </SortableContext>

          <DragOverlay>
            {activeTask && <KanbanTaskCard task={activeTask} isDragging />}
            {activeColumn && (
              <KanbanColumnComponent
                column={activeColumn}
                canManage={false}
                canAddTask={false}
                isDragging
                onAddTask={() => {}}
                onEditColumn={() => {}}
                onDeleteColumn={() => {}}
                onEditTask={() => {}}
                  onArchiveTask={() => {}}
                onViewTask={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      </Box>

      {/* Task View Dialog */}
      <TaskViewDialog
        open={!!viewingTask}
        onClose={() => setViewingTask(null)}
        onEdit={() => { if (viewingTask) openEditTask(viewingTask); }}
        onArchive={archiveTask}
        onRefresh={() => { setViewingTask(null); fetchBoard(true); }}
        task={viewingTask}
        column={viewingTask ? columns.find((c) => c.id === viewingTask.column_id) : undefined}
        currentUser={profile}
      />

      {/* Archive Dialog */}
      <TaskArchiveDialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        onRefresh={() => fetchBoard(true)}
        columns={columns}
        currentUser={profile}
      />

      {/* Delete Column Confirmation */}
      <Dialog
        open={!!deleteColConfirm}
        onClose={() => setDeleteColConfirm(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <WarningIcon color="warning" />
          Delete Column
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            Are you sure you want to delete <strong>{deleteColConfirm?.title}</strong>?
          </Typography>
          {(() => {
            const count = columns.find((c) => c.id === deleteColConfirm?.id)?.tasks?.length ?? 0;
            const otherCols = columns.filter((c) => c.id !== deleteColConfirm?.id);
            
            if (count > 0) {
              return (
                <Box>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    This column currently has <strong>{count}</strong> task{count !== 1 ? 's' : ''}.
                  </Alert>
                  <Typography variant="subtitle2" mb={1} fontWeight={600}>
                    What would you like to do with these tasks?
                  </Typography>
                  <FormControl component="fieldset" fullWidth>
                    <RadioGroup
                      value={deleteColAction}
                      onChange={(e) => setDeleteColAction(e.target.value as 'move' | 'archive')}
                    >
                      <FormControlLabel
                        value="archive"
                        control={<Radio />}
                        label="Archive all tasks"
                      />
                      <FormControlLabel
                        value="move"
                        control={<Radio />}
                        disabled={otherCols.length === 0}
                        label={otherCols.length === 0 ? "Move tasks to another column (create one first)" : "Move tasks to another column"}
                      />
                    </RadioGroup>
                  </FormControl>

                  {deleteColAction === 'move' && otherCols.length > 0 && (
                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                      <InputLabel id="delete-move-target-label">Destination Column</InputLabel>
                      <Select
                        labelId="delete-move-target-label"
                        value={deleteColMoveTarget}
                        label="Destination Column"
                        onChange={(e) => setDeleteColMoveTarget(e.target.value as string)}
                      >
                        {otherCols.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.title}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>
              );
            } else {
              return (
                <Typography variant="body2" color="text.secondary">
                  This column has no tasks and will be removed immediately.
                </Typography>
              );
            }
          })()}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteColConfirm(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteColumn}
            disabled={
              !!deleteColConfirm && 
              (columns.find((c) => c.id === deleteColConfirm.id)?.tasks?.length ?? 0) > 0 &&
              deleteColAction === 'move' &&
              !deleteColMoveTarget
            }
          >
            Delete Column
          </Button>
        </DialogActions>
      </Dialog>

      {/* Task Create/Edit Modal */}
      <TaskModal
        open={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditingTask(null); }}
        onSave={() => { setTaskModalOpen(false); setEditingTask(null); fetchBoard(true); }}
        editingTask={editingTask}
        defaultColumnId={defaultColumnId}
        columns={columns}
        ojts={allOjts}
        currentUser={profile}
      />

      {/* Column Create/Edit Dialog */}
      <ColumnDialog
        open={columnDialogOpen}
        onClose={() => setColumnDialogOpen(false)}
        onSave={handleSaveColumn}
        editingColumn={editingColumn}
        nextPosition={columns.length}
        profileId={initialProfile.id}
      />
    </Box>
  );
}
