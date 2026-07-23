'use client';

import React, { useState, useEffect } from 'react';
import {
  Drawer, Box, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Avatar, Divider, IconButton, Tooltip,
  Chip, Badge, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Alert, CircularProgress, MenuItem, Select,
  FormControl, InputLabel,
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
  Business as OrgIcon,
  SmartToy as AutomationIcon,
  Hub as IntegrationIcon,
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
  { label: 'Automation', icon: <AutomationIcon />, path: '/dashboard/admin/automation', roles: ['admin'] },
  { label: 'Integrations', icon: <IntegrationIcon />, path: '/dashboard/admin/integrations', roles: ['admin'] },
  { label: 'Site Settings', icon: <SettingsIcon />, path: '/dashboard/admin/settings', roles: ['admin'] },
];

export default function Sidebar({ profile }: { profile: Profile }) {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastAdminDialogOpen, setLastAdminDialogOpen] = useState(false);
  const [eligibleMembers, setEligibleMembers] = useState<Profile[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [promotingAndLeaving, setPromotingAndLeaving] = useState(false);
  const [promotionError, setPromotionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { organization } = useAuth();

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const notifications = await res.json();
        const unread = (notifications || []).filter((n: { is_read: boolean }) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchUnreadCount());
    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen to path changes to refresh unread count immediately
  useEffect(() => {
    Promise.resolve().then(() => fetchUnreadCount());
  }, [pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  const handleLeaveOrg = async () => {
    if (!profile?.org_id) return;

    try {
      // 1. Fetch other admins to see if this user is the last remaining admin
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', profile.org_id)
        .eq('role', 'admin');

      if (adminsError) {
        alert('Failed to verify organization administrators.');
        return;
      }

      if (profile.role === 'admin' && (!admins || admins.length <= 1)) {
        // Fetch eligible members to promote (role !== 'admin' and active)
        const { data: members, error: membersError } = await supabase
          .from('profiles')
          .select('*')
          .eq('org_id', profile.org_id)
          .neq('role', 'admin')
          .eq('is_active', true);

        if (membersError) {
          alert('Failed to retrieve eligible members for promotion.');
          return;
        }

        setEligibleMembers(members ?? []);
        setSelectedMemberId('');
        setPromotionError('');
        setLastAdminDialogOpen(true);
        return;
      }

      // If not the last admin, proceed with standard confirmation
      const confirmLeave = window.confirm(
        'Are you sure you want to leave your organization? You will lose access to all organization-specific features.'
      );
      if (!confirmLeave) return;

      const res = await fetch('/api/organizations/leave', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? 'Failed to leave organization.');
      } else {
        await supabase.auth.refreshSession();
        router.refresh();
        router.push(`/dashboard/${profile?.role}`);
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred.');
    }
  };

  const handlePromoteAndLeave = async () => {
    if (!selectedMemberId) {
      setPromotionError('Please select a member to promote.');
      return;
    }

    setPromotingAndLeaving(true);
    setPromotionError('');

    try {
      // 1. Promote selected user to admin
      const { error: promoteError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', selectedMemberId);

      if (promoteError) {
        setPromotionError(`Promotion failed: ${promoteError.message}`);
        setPromotingAndLeaving(false);
        return;
      }

      // 2. Perform the leave request
      const res = await fetch('/api/organizations/leave', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        // Rollback promotion if leave fails (e.g. race condition or error)
        const originalRole = eligibleMembers.find(m => m.id === selectedMemberId)?.role || 'ojt';
        await supabase
          .from('profiles')
          .update({ role: originalRole })
          .eq('id', selectedMemberId);

        setPromotionError(json.error ?? 'Failed to leave organization after promotion.');
        setPromotingAndLeaving(false);
      } else {
        setLastAdminDialogOpen(false);
        await supabase.auth.refreshSession();
        router.refresh();
        router.push(`/dashboard/${profile?.role}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPromotionError(msg || 'An unexpected error occurred.');
      setPromotingAndLeaving(false);
    }
  };

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
        {profile?.org_id && (
          <Tooltip title={collapsed ? 'Leave Organization' : ''} placement="right">
            <ListItemButton
              onClick={handleLeaveOrg}
              sx={{
                minHeight: 48,
                justifyContent: collapsed ? 'center' : 'initial',
                px: 2.5,
                mx: 1,
                mb: 0.5,
                borderRadius: 2,
                color: '#f87171',
                '&:hover': { bgcolor: 'rgba(248,113,113,0.1)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 2, color: '#f87171' }}>
                <OrgIcon />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary="Leave Org"
                  primaryTypographyProps={{ fontSize: 14, color: '#f87171' }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        )}
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

      {/* Last Admin Leave Dialog */}
      <Dialog
        open={lastAdminDialogOpen}
        onClose={() => !promotingAndLeaving && setLastAdminDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: '#161616',
            color: '#fff',
            border: '1px solid #262626',
          }
        }}
      >
        <DialogTitle component="div" sx={{ borderBottom: '1px solid #262626', pb: 2, fontWeight: 700, fontSize: '1.25rem' }}>
          Promote Administrator Before Leaving
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {promotionError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {promotionError}
            </Alert>
          )}

          <Typography variant="body2" sx={{ color: '#a1a1aa', mb: 3, lineHeight: 1.6 }}>
            Every organization must have at least one administrator. Since you are the only remaining administrator of this organization, you must promote another member to administrator before you can leave.
          </Typography>

          {eligibleMembers.length === 0 ? (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              There are no other active members in this organization to promote. You cannot leave until you invite and onboard another member.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search members by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                slotProps={{
                  input: {
                    style: { color: '#fff' }
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#262626' },
                    '&:hover fieldset': { borderColor: '#52525b' },
                    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                  }
                }}
              />

              <FormControl fullWidth>
                <InputLabel id="promote-member-label" sx={{ color: '#a1a1aa' }}>Select Member *</InputLabel>
                <Select
                  labelId="promote-member-label"
                  value={selectedMemberId}
                  label="Select Member *"
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  sx={{
                    color: '#fff',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: '#262626' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#52525b' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
                    '.MuiSvgIcon-root': { color: '#a1a1aa' },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: '#161616',
                        color: '#fff',
                        border: '1px solid #262626',
                        '& .MuiMenuItem-root:hover': { bgcolor: '#262626' },
                        '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'rgba(99, 102, 241, 0.2)' },
                      }
                    }
                  }}
                >
                  {eligibleMembers
                    .filter(m => 
                      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      m.email.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((member) => (
                      <MenuItem key={member.id} value={member.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2" fontWeight={600}>{member.full_name}</Typography>
                          <Typography variant="caption" sx={{ color: '#a1a1aa' }}>
                            {member.email} • Role: {roleLabel(member.role)}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))
                  }
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #262626', gap: 1 }}>
          <Button
            onClick={() => setLastAdminDialogOpen(false)}
            disabled={promotingAndLeaving}
            sx={{ color: '#a1a1aa' }}
          >
            Cancel
          </Button>
          {eligibleMembers.length > 0 && (
            <Button
              variant="contained"
              onClick={handlePromoteAndLeave}
              disabled={!selectedMemberId || promotingAndLeaving}
              startIcon={promotingAndLeaving ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{
                bgcolor: '#ef4444',
                color: '#fff',
                '&:hover': { bgcolor: '#dc2626' },
                '&:disabled': { bgcolor: '#52525b', color: '#a1a1aa' }
              }}
            >
              Promote & Leave
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}