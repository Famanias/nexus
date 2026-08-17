'use client';

import React from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
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
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          height: '100dvh',
        }}
      >
        <Topbar profile={profile} />
        <Box
          component="main"
          id="main-content"
          sx={{
            flex: 1,
            overflow: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}