'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, IconButton, Button, Avatar, Typography, Badge, Divider,
  Popover, Tooltip, List, ListItemButton, ListItemIcon, ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  Notifications as BellIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  KeyboardArrowDown as ChevronDownIcon,
  Email as EmailIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, Notification } from '@/types';
import { roleLabel, formatDateTime } from '@/lib/utils/format';

const POPOVER_WIDTH = 360;
const SETTINGS_PATH = '/dashboard/admin/settings';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'invitation_sent':
      return <EmailIcon color="primary" />;
    case 'invitation_accepted':
      return <SuccessIcon color="success" />;
    case 'invitation_expired':
      return <ErrorIcon color="error" />;
    case 'invitation_revoked':
      return <BlockIcon color="action" />;
    default:
      return <BellIcon color="info" />;
  }
}

export default function Topbar({ profile }: { profile: Profile }) {
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const notifPaperRef = useRef<HTMLDivElement>(null);
  const profilePaperRef = useRef<HTMLDivElement>(null);

  const activeRole = profile?.system_role ?? profile?.role ?? '';
  const isAdmin = activeRole === 'admin';
  const isSettingsActive = pathname.startsWith(SETTINGS_PATH);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchNotifications());
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    Promise.resolve().then(() => fetchNotifications());
  }, [pathname, fetchNotifications]);

  useEffect(() => {
    setNotifAnchor(null);
    setProfileAnchor(null);
  }, [pathname]);

  // Close any open popover when clicking outside it and its trigger.
  // Both popovers render with a pointer-transparent Modal layer so the
  // page (and the other topbar trigger) remain clickable — this handler
  // replicates the reference's outside-click close and one-at-a-time switch.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        notifAnchor &&
        notifPaperRef.current &&
        !notifPaperRef.current.contains(target) &&
        notifBtnRef.current &&
        !notifBtnRef.current.contains(target)
      ) {
        setNotifAnchor(null);
      }
      if (
        profileAnchor &&
        profilePaperRef.current &&
        !profilePaperRef.current.contains(target) &&
        profileBtnRef.current &&
        !profileBtnRef.current.contains(target)
      ) {
        setProfileAnchor(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [notifAnchor, profileAnchor]);

  const toggleNotif = () => {
    if (notifAnchor) {
      setNotifAnchor(null);
      return;
    }
    setProfileAnchor(null);
    setNotifAnchor(notifBtnRef.current);
  };

  const toggleProfile = () => {
    if (profileAnchor) {
      setProfileAnchor(null);
      return;
    }
    setNotifAnchor(null);
    setProfileAnchor(profileBtnRef.current);
  };

  const handleSignOut = async () => {
    setProfileAnchor(null);
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingRead(false);
    }
  };

  const paperSx = {
    width: POPOVER_WIDTH,
    maxWidth: 'calc(100vw - 32px)',
    bgcolor: '#16161a',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.7)',
  };

  return (
    <Box
      component="header"
      sx={{
        height: 64,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        px: 3,
        bgcolor: 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <Box />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
        {/* Notifications */}
        <Tooltip title="Notifications">
          <IconButton
            ref={notifBtnRef}
            id="btn-notif"
            aria-label="Notifications"
            aria-haspopup="dialog"
            aria-expanded={!!notifAnchor}
            aria-controls={notifAnchor ? 'pop-notif' : undefined}
            onClick={toggleNotif}
            sx={{
              color: 'text.secondary',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'text.primary' },
              ...(notifAnchor && {
                bgcolor: 'rgba(99, 102, 241, 0.15)',
                color: 'primary.light',
                border: '1px solid',
                borderColor: 'divider',
              }),
            }}
          >
            <Badge badgeContent={unreadCount} color="error" max={99}>
              <BellIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Settings — navigates to the Settings page like a sidebar nav item */}
        {isAdmin && (
          <Tooltip title="Settings">
            <IconButton
              id="btn-settings"
              component={Link}
              href={SETTINGS_PATH}
              aria-label="Settings"
              aria-current={isSettingsActive ? 'page' : undefined}
              sx={{
                color: isSettingsActive ? 'primary.light' : 'text.secondary',
                bgcolor: isSettingsActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                '&:hover': {
                  bgcolor: isSettingsActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: isSettingsActive ? 'primary.light' : 'text.primary',
                },
              }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1, bgcolor: 'divider' }} />

        {/* Profile */}
        <Button
          ref={profileBtnRef}
          id="btn-profile"
          aria-haspopup="menu"
          aria-expanded={!!profileAnchor}
          aria-controls={profileAnchor ? 'pop-profile' : undefined}
          onClick={toggleProfile}
          disableRipple
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.5,
            pl: 0.5,
            pr: 1.5,
            borderRadius: 999,
            border: '1px solid transparent',
            color: 'text.primary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
            ...(profileAnchor && {
              bgcolor: 'rgba(99, 102, 241, 0.15)',
              borderColor: 'divider',
            }),
          }}
        >
          <Avatar
            src={profile?.avatar_url}
            sx={{
              width: 34,
              height: 34,
              bgcolor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid',
              borderColor: 'divider',
              color: 'primary.light',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {profile?.full_name?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ textAlign: 'left', lineHeight: 1.2, display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }} color="text.primary">
              {profile?.full_name}
            </Typography>
            <Typography sx={{ fontSize: 11 }} color="text.secondary">
              {roleLabel(profile?.role ?? '')}
            </Typography>
          </Box>
          <ChevronDownIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
        </Button>
      </Box>

      {/* Notifications popover (anchored to the bell button) */}
      <Popover
        id="pop-notif"
        open={!!notifAnchor}
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disableScrollLock
        hideBackdrop
        sx={{ pointerEvents: 'none' }}
        slotProps={{
          paper: {
            ref: notifPaperRef,
            role: 'dialog',
            'aria-labelledby': 'pop-notif-title',
            tabIndex: -1,
            sx: {
              ...paperSx,
              pointerEvents: 'auto',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography id="pop-notif-title" sx={{ fontSize: 15, fontWeight: 700 }}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button
              onClick={handleMarkAllRead}
              disabled={markingRead}
              sx={{ fontSize: 12, color: 'primary.light', p: 0.5, minWidth: 0 }}
            >
              {markingRead ? <CircularProgress size={12} color="inherit" /> : 'Mark all read'}
            </Button>
          )}
        </Box>

        <Box sx={{ px: 1, py: 1, maxHeight: '60vh', overflowY: 'auto' }}>
          {notifLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <BellIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.5, mb: 1 }} />
              <Typography sx={{ fontSize: 13 }} color="text.secondary">
                You have no notifications yet.
              </Typography>
            </Box>
          ) : (
            notifications.slice(0, 6).map((n) => (
              <Box
                key={n.id}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: n.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.06)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {getNotificationIcon(n.type)}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                    {n.title}
                    {!n.is_read && (
                      <Box
                        component="span"
                        sx={{
                          ml: 0.75,
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#fff',
                          bgcolor: 'primary.main',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 999,
                          verticalAlign: 'middle',
                        }}
                      >
                        NEW
                      </Box>
                    )}
                  </Typography>
                  <Typography sx={{ fontSize: 12, mt: 0.25 }} color="text.secondary" noWrap>
                    {n.message}
                  </Typography>
                  <Typography sx={{ fontSize: 11, mt: 0.5 }} color="text.secondary">
                    {formatDateTime(n.created_at)}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>

        <Box sx={{ py: 1.5, px: 2, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Link
            href="/dashboard/notifications"
            onClick={() => setNotifAnchor(null)}
            style={{ fontSize: 12, fontWeight: 600, color: '#818cf8', textDecoration: 'none' }}
          >
            View all notifications
          </Link>
        </Box>
      </Popover>

      {/* Profile popover (anchored to the profile button) */}
      <Popover
        id="pop-profile"
        open={!!profileAnchor}
        anchorEl={profileAnchor}
        onClose={() => setProfileAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disableScrollLock
        hideBackdrop
        sx={{ pointerEvents: 'none' }}
        slotProps={{
          paper: {
            ref: profilePaperRef,
            role: 'menu',
            'aria-labelledby': 'pop-profile-title',
            tabIndex: -1,
            sx: {
              ...paperSx,
              pointerEvents: 'auto',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            pt: 2,
            pb: 1,
          }}
        >
          <Avatar
            src={profile?.avatar_url}
            sx={{
              width: 44,
              height: 44,
              bgcolor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid',
              borderColor: 'divider',
              color: 'primary.light',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {profile?.full_name?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }} id="pop-profile-title">
            <Typography sx={{ fontSize: 14, fontWeight: 700 }} color="text.primary" noWrap>
              {profile?.full_name}
            </Typography>
            <Typography sx={{ fontSize: 12 }} color="text.secondary" noWrap>
              {profile?.email}
            </Typography>
          </Box>
        </Box>

        <List sx={{ px: 1, pb: 1, pt: 0.5 }}>
          <ListItemButton
            role="menuitem"
            onClick={handleSignOut}
            sx={{
              borderRadius: 1,
              color: 'error.light',
              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'error.light' }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: 13 }} />
          </ListItemButton>
        </List>
      </Popover>
    </Box>
  );
}