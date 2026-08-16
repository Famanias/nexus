'use client';

import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress, Chip } from '@mui/material';
import { AccessTime as ClockIcon } from '@mui/icons-material';
import { AttendanceSummary } from '@/types';
import { formatHours } from '@/lib/utils/format';

interface Props {
  summary: AttendanceSummary | null;
}

export default function HoursProgress({ summary }: Props) {
  if (!summary) return null;

  const pct = summary.completion_percentage;
  const color = pct >= 100 ? '#22c55e' : pct >= 75 ? '#6366f1' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <Card sx={{ borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: `${color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
            }}
          >
            <ClockIcon />
          </Box>
          <Typography variant="h6" fontWeight={700}>OJT Hours Progress</Typography>
        </Box>

        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h3" fontWeight={800} sx={{ color }}>
            {pct.toFixed(1)}%
          </Typography>
          <Typography variant="body2" color="text.secondary">Completion</Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={Math.min(pct, 100)}
          sx={{
            height: 12,
            borderRadius: 6,
            bgcolor: 'action.hover',
            mb: 3,
            '& .MuiLinearProgress-bar': {
              borderRadius: 6,
              background: `linear-gradient(90deg, ${color}88, ${color})`,
            },
          }}
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box sx={{ p: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Logged Hours</Typography>
            <Typography variant="h6" fontWeight={700} color="text.primary">
              {formatHours(summary.total_hours)}
            </Typography>
          </Box>
          <Box sx={{ p: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Required Hours</Typography>
            <Typography variant="h6" fontWeight={700} color="text.primary">
              {formatHours(summary.required_hours)}
            </Typography>
          </Box>
          <Box sx={{ p: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2, gridColumn: '1/-1' }}>
            <Typography variant="caption" color="text.secondary">Remaining Hours</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ color: summary.remaining_hours > 0 ? '#ef4444' : '#22c55e' }}>
              {summary.remaining_hours > 0
                ? formatHours(summary.remaining_hours) + ' left'
                : 'Completed! 🎉'}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`${summary.total_days} days rendered`} size="small" variant="outlined" />
          {pct >= 100 && (
            <Chip label="OJT Complete" color="success" size="small" />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
