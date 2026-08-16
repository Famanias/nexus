'use client';

import React from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import { Profile } from '@/types';

interface Props {
  profile: Profile;
  children: React.ReactNode;
}

export default function DashboardShell({ profile, children }: Props) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar profile={profile} />
      <Box
        component="main"
        id="main-content"
        sx={{
          flex: 1,
          overflow: 'auto',
          minHeight: '100dvh',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
