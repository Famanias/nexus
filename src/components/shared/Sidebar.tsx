'use client';

import React, { useState } from 'react';
import {
  Drawer, Box, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  AccessTime as ClockIcon,
  People as PeopleIcon,
  ViewKanban as KanbanIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  BarChart as ReportIcon,
  SmartToy as AutomationIcon,
  Hub as IntegrationIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { Profile } from '@/types';
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
  { label: 'Automation', icon: <AutomationIcon />, path: '/dashboard/admin/automation', roles: ['admin'] },
  { label: 'Integrations', icon: <IntegrationIcon />, path: '/dashboard/admin/integrations', roles: ['admin'] },
];

export default function Sidebar({ profile }: { profile: Profile }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { organization } = useAuth();

  const activeRole = profile?.system_role ?? profile?.role ?? '';

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(activeRole)
  );

  const handleNav = (path: string) => {
    if (path === '/dashboard') {
      router.push(`/dashboard/${activeRole}`);
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
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderRight: '1px solid',
          borderColor: 'divider',
          height: '100dvh',
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
            <Typography
              component="div"
              noWrap
              sx={{ fontFamily: 'var(--font-blanka), sans-serif', fontSize: '1.1rem', letterSpacing: '.04em', color: 'text.primary' }}
            >
              Nexus
            </Typography>
            {organization && (
              <Typography variant="caption" color="text.secondary" noWrap display="block" mt={0.25}>
                {organization.name}
              </Typography>
            )}
          </Box>
        )}
        <IconButton onClick={() => setCollapsed(!collapsed)} sx={{ color: 'text.secondary' }} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: 'divider' }} />

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
                  borderRadius: 1,
                  bgcolor: isActive(item.path) ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: isActive(item.path) ? 'primary.light' : 'text.secondary',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: collapsed ? 0 : 2,
                    justifyContent: 'center',
                    color: isActive(item.path) ? 'primary.light' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={
                      <Typography
                        fontSize={14}
                        fontWeight={isActive(item.path) ? 600 : 400}
                        color={isActive(item.path) ? 'text.primary' : 'text.secondary'}
                      >
                        {item.label}
                      </Typography>
                    }
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
}