'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, CircularProgress,
} from '@mui/material';
import { KanbanColumn } from '@/types';

const PRESET_COLORS = [
  '#6366f1', '#f59e0b', '#22c55e', '#ef4444',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, color: string) => Promise<void>;
  editingColumn: KanbanColumn | null;
  nextPosition: number;
  profileId?: string;
}

export default function ColumnDialog({ open, onClose, onSave, editingColumn }: Props) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingColumn) {
      setTitle(editingColumn.title);
      setColor(editingColumn.color);
    } else {
      setTitle('');
      setColor('#6366f1');
    }
    setError('');
  }, [editingColumn, open]);

  const handleSave = async () => {
    if (!title.trim()) { setError('Column title is required.'); return; }
    setSaving(true);
    setError('');

    try {
      await onSave(title.trim(), color);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>
        {editingColumn ? 'Edit Column' : 'Add Column'}
      </DialogTitle>
      <DialogContent dividers>
        {error && <Typography color="error" variant="body2" sx={{ mb: 1 }}>{error}</Typography>}

        <TextField
          fullWidth label="Column Title" value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mb: 2 }} autoFocus
        />

        <Typography variant="body2" fontWeight={600} mb={1}>Color</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map((c) => (
            <Box
              key={c}
              onClick={() => setColor(c)}
              sx={{
                width: 32, height: 32, borderRadius: '50%',
                bgcolor: c, cursor: 'pointer',
                border: color === c ? '3px solid #1e1b4b' : '3px solid transparent',
                outline: color === c ? `3px solid ${c}` : 'none',
                outlineOffset: 2,
                transition: 'all 0.15s',
              }}
            />
          ))}
        </Box>

        {/* Preview */}
        <Box
          sx={{
            mt: 2, p: 1.5, borderRadius: 2, borderLeft: `4px solid ${color}`,
            bgcolor: `${color}15`,
          }}
        >
          <Typography variant="body2" fontWeight={600} color={color}>
            {title || 'Column Preview'}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {editingColumn ? 'Save Changes' : 'Add Column'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
