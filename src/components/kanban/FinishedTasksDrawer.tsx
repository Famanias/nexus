import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Box, Typography, IconButton, MenuItem, Select, FormControl, InputLabel, CircularProgress, Chip, Stack, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import UndoIcon from '@mui/icons-material/Undo';
import { format } from 'date-fns';

interface FinishedTask {
  id: string;
  title: string;
  priority: string;
  completed_at: string;
  column: { title: string };
  assignee?: { full_name: string; avatar_url: string };
  completed_by_profile?: { full_name: string; email: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onTaskReopened?: () => void;
}

export default function FinishedTasksDrawer({ open, onClose, onTaskReopened }: Props) {
  const [tasks, setTasks] = useState<FinishedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');
  const [sort, setSort] = useState('newest');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kanban/tasks/finished?timeRange=${timeRange}&sort=${sort}`);
      const data = await res.json();
      if (res.ok) {
        setTasks(data.tasks || []);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [timeRange, sort]);

  const handleUncomplete = async (id: string) => {
    try {
      const res = await fetch(`/api/kanban/tasks/${id}/uncomplete`, { method: 'POST' });
      if (res.ok) {
        fetchTasks();
        if (onTaskReopened) onTaskReopened();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reopen task');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTasks();
    }
  }, [open, timeRange, sort, fetchTasks]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, p: 0, bgcolor: '#f8fafc' } }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TaskAltIcon color="success" />
          <Typography variant="h6" fontWeight={700}>Finished Tasks</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p: 2, display: 'flex', gap: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Time</InputLabel>
          <Select value={timeRange} label="Time" onChange={(e) => setTimeRange(e.target.value)}>
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="7days">Last 7 Days</MenuItem>
            <MenuItem value="30days">Last 30 Days</MenuItem>
            <MenuItem value="month">This Month</MenuItem>
            <MenuItem value="all">All Time</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Sort</InputLabel>
          <Select value={sort} label="Sort" onChange={(e) => setSort(e.target.value)}>
            <MenuItem value="newest">Newest First</MenuItem>
            <MenuItem value="oldest">Oldest First</MenuItem>
            <MenuItem value="a-z">A - Z</MenuItem>
            <MenuItem value="z-a">Z - A</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
        ) : tasks.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" mt={4}>No finished tasks found.</Typography>
        ) : (
          <Stack spacing={2}>
            {tasks.map(t => (
              <Box key={t.id} sx={{ bgcolor: '#ffffff', p: 2, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <Typography fontWeight={600} gutterBottom>{t.title}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" label={t.column?.title} sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 500 }} />
                  <Chip size="small" label={`Priority: ${t.priority}`} color={t.priority === 'high' ? 'error' : t.priority === 'medium' ? 'warning' : 'default'} variant="outlined" />
                </Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Completed on {format(new Date(t.completed_at), 'MMM d, yyyy h:mm a')}
                </Typography>
                {(t.completed_by_profile || t.assignee) && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    By {t.completed_by_profile?.full_name || t.assignee?.full_name || 'Unknown'}
                  </Typography>
                )}
                <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    startIcon={<UndoIcon />}
                    onClick={() => handleUncomplete(t.id)}
                    color="primary"
                    variant="outlined"
                  >
                    Reopen Task
                  </Button>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
