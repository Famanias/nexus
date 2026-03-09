'use client';

import React, { useState } from 'react';
import {
  Drawer, Box, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Avatar, Divider, IconButton, Tooltip,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  AccessTime as ClockIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  ViewKanban as KanbanIcon,
  Logout as LogoutIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  BarChart as ReportIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { roleLabel } from '@/lib/utils/format';
import { useAuth } from '@/lib/context/AuthContext';

const DRAWER_WIDTH = 260;
const DRAWER_MINI = 72;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: ['ojt', 'supervisor', 'admin'] },
  { label: 'Attendance', icon: <ClockIcon />, path: '/dashboard/attendance', roles: ['ojt', 'supervisor', 'admin'] },
  { label: 'Kanban Board', icon: <KanbanIcon />, path: '/dashboard/kanban', roles: ['ojt', 'supervisor', 'admin'] },
  { label: 'Reports', icon: <ReportIcon />, path: '/dashboard/reports', roles: ['supervisor', 'admin'] },
  { label: 'Users', icon: <PeopleIcon />, path: '/dashboard/admin/users', roles: ['admin'] },
  { label: 'Site Settings', icon: <SettingsIcon />, path: '/dashboard/admin/settings', roles: ['admin'] },
];

export default function Sidebar({ profile }: { profile: Profile }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { organization } = useAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(profile?.role ?? '')
  );

  const handleNav = (path: string) => {
    if (path === '/dashboard') {
      router.push(`/dashboard/${profile?.role}`);
    } else {
      router.push(path);
    }
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return false;
    return pathname.startsWith(path);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? DRAWER_MINI : DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? DRAWER_MINI : DRAWER_WIDTH,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: 'width 0.3s ease',
          background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)',
          color: '#fff',
          border: 'none',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          px: collapsed ? 1 : 2,
          py: 2,
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <Box>
            <Typography variant="h6" fontWeight={700} color="#fff" noWrap>
              OJT Tracker
            </Typography>
            {organization && (
              <Typography variant="caption" color="rgba(255,255,255,0.55)" noWrap display="block" mt={0.25}>
                {organization.name}
              </Typography>
            )}
          </Box>
        )}
        <IconButton onClick={() => setCollapsed(!collapsed)} sx={{ color: '#a5b4fc' }}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* User info */}
      <Box sx={{ px: collapsed ? 1 : 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          src={profile?.avatar_url}
          sx={{ width: 40, height: 40, bgcolor: '#818cf8', fontSize: 16, flexShrink: 0 }}
        >
          {profile?.full_name?.charAt(0).toUpperCase()}
        </Avatar>
        {!collapsed && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} color="#fff" noWrap>
              {profile?.full_name}
            </Typography>
            <Chip
              label={roleLabel(profile?.role ?? '')}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.15)',
                color: '#c7d2fe',
                fontSize: 10,
                height: 18,
              }}
            />
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* Navigation */}
      <List sx={{ pt: 1, flex: 1 }}>
        {filteredItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
            <Tooltip title={collapsed ? item.label : ''} placement="right">
              <ListItemButton
                onClick={() => handleNav(item.path)}
                sx={{
                  minHeight: 48,
                  justifyContent: collapsed ? 'center' : 'initial',
                  px: 2.5,
                  mx: 1,
                  mb: 0.5,
                  borderRadius: 2,
                  bgcolor: isActive(item.path) ? 'rgba(255,255,255,0.15)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: collapsed ? 0 : 2,
                    justifyContent: 'center',
                    color: isActive(item.path) ? '#fff' : '#a5b4fc',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: 14,
                      fontWeight: isActive(item.path) ? 600 : 400,
                      color: isActive(item.path) ? '#fff' : '#c7d2fe',
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      {/* Sign Out */}
      <Box sx={{ pb: 2 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 1 }} />
        <Tooltip title={collapsed ? 'Sign Out' : ''} placement="right">
          <ListItemButton
            onClick={signOut}
            sx={{
              minHeight: 48,
              justifyContent: collapsed ? 'center' : 'initial',
              px: 2.5,
              mx: 1,
              borderRadius: 2,
              color: '#fca5a5',
              '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 2, color: '#fca5a5' }}>
              <LogoutIcon />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="Sign Out"
                primaryTypographyProps={{ fontSize: 14, color: '#fca5a5' }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Drawer>
  );
}
