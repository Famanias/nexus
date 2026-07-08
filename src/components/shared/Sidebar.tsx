'use client';

import React, { useState, useEffect } from 'react';
import {
  Drawer, Box, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Avatar, Divider, IconButton, Tooltip,
  Chip, Badge,
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
  Notifications as NotificationsIcon,
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
  { label: 'Notifications', icon: <NotificationsIcon />, path: '/dashboard/notifications', roles: ['ojt', 'supervisor', 'admin'] },
  { label: 'Reports', icon: <ReportIcon />, path: '/dashboard/reports', roles: ['supervisor', 'admin'] },
  { label: 'Users', icon: <PeopleIcon />, path: '/dashboard/admin/users', roles: ['admin'] },
  { label: 'Site Settings', icon: <SettingsIcon />, path: '/dashboard/admin/settings', roles: ['admin'] },
];

export default function Sidebar({ profile }: { profile: Profile }) {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { organization } = useAuth();

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const notifications = await res.json();
        const unread = notifications.filter((n: any) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen to path changes to refresh unread count immediately
  useEffect(() => {
    fetchUnreadCount();
  }, [pathname]);

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
          background: '#0a0a0a',
          color: '#fff',
          borderRight: '1px solid #262626',
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
              sx={{ fontFamily: 'var(--font-blanka), sans-serif', fontSize: '1.1rem', letterSpacing: '.04em', color: '#fff' }}
            >
              Nexus
            </Typography>
            {organization && (
              <Typography variant="caption" sx={{ color: '#71717a' }} noWrap display="block" mt={0.25}>
                {organization.name}
              </Typography>
            )}
          </Box>
        )}
        <IconButton onClick={() => setCollapsed(!collapsed)} sx={{ color: '#a1a1aa' }}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: '#262626' }} />

      {/* User info */}
      <Box
        sx={{
          mx: 1,
          px: collapsed ? 0 : 2.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 1.5,
        }}
      >
        <Avatar
          src={profile?.avatar_url}
          sx={{
            width: 40,
            height: 40,
            bgcolor: '#161616',
            border: '1px solid #262626',
            color: '#fff',
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {profile?.full_name?.charAt(0).toUpperCase()}
        </Avatar>
        {!collapsed && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#fff' }} noWrap>
              {profile?.full_name}
            </Typography>
            <Chip
              label={roleLabel(profile?.role ?? '')}
              size="small"
              sx={{
                bgcolor: 'transparent',
                border: '1px solid #262626',
                color: '#a1a1aa',
                fontSize: 10,
                height: 18,
              }}
            />
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: '#262626' }} />

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
                  bgcolor: isActive(item.path) ? 'rgba(255,255,255,0.08)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: collapsed ? 0 : 2,
                    justifyContent: 'center',
                    color: isActive(item.path) ? '#fff' : '#a1a1aa',
                  }}
                >
                  {item.label === 'Notifications' && unreadCount > 0 ? (
                    <Badge badgeContent={unreadCount} color="error" max={99}>
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography
                          fontSize={14}
                          fontWeight={isActive(item.path) ? 600 : 400}
                          color={isActive(item.path) ? '#fff' : '#a1a1aa'}
                        >
                          {item.label}
                        </Typography>
                        {item.label === 'Notifications' && unreadCount > 0 && (
                          <Chip
                            label={unreadCount}
                            color="error"
                            size="small"
                            sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                          />
                        )}
                      </Box>
                    }
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      {/* Sign Out */}
      <Box sx={{ pb: 2 }}>
        <Divider sx={{ borderColor: '#262626', mb: 1 }} />
        <Tooltip title={collapsed ? 'Sign Out' : ''} placement="right">
          <ListItemButton
            onClick={signOut}
            sx={{
              minHeight: 48,
              justifyContent: collapsed ? 'center' : 'initial',
              px: 2.5,
              mx: 1,
              borderRadius: 2,
              color: '#f87171',
              '&:hover': { bgcolor: 'rgba(248,113,113,0.1)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 2, color: '#f87171' }}>
              <LogoutIcon />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="Sign Out"
                primaryTypographyProps={{ fontSize: 14, color: '#f87171' }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Drawer>
  );
}