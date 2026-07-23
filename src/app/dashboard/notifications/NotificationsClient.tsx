'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Stack,
  List, ListItem, ListItemText, ListItemIcon, IconButton, Chip,
  Divider, CircularProgress, Alert, Tooltip
} from '@mui/material';
import {
  Notifications as BellIcon,
  MarkEmailRead as ReadIcon,
  Email as EmailIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { Notification } from '@/types';
import { formatDate } from '@/lib/utils/format';

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to load notifications.');
      const data = await res.json();
      setNotifications(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', id }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
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
    }
  };

  const getNotificationIcon = (type: string) => {
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
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BellIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight={800}>Notifications</Typography>
            <Typography color="text.secondary">Stay updated with organizational activity.</Typography>
          </Box>
        </Box>
        {unreadCount > 0 && (
          <Button
            variant="contained"
            startIcon={<ReadIcon />}
            onClick={handleMarkAllRead}
            sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 600 }}
          >
            Mark All as Read
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card sx={{ borderRadius: 3, border: '1px solid #eaeaea', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {notifications.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <BellIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 1 }} />
              <Typography color="text.secondary">You have no notifications yet.</Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {notifications.map((notif, idx) => (
                <React.Fragment key={notif.id}>
                  {idx > 0 && <Divider />}
                  <ListItem
                    sx={{
                      py: 2.5,
                      px: 3,
                      bgcolor: notif.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.04)',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        bgcolor: notif.is_read ? 'rgba(0, 0, 0, 0.01)' : 'rgba(99, 102, 241, 0.06)',
                      },
                    }}
                    secondaryAction={
                      !notif.is_read && (
                        <Tooltip title="Mark as read">
                          <IconButton edge="end" size="small" onClick={() => handleMarkRead(notif.id)}>
                            <ReadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 46 }}>
                      {getNotificationIcon(notif.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography
                            variant="subtitle2"
                            fontWeight={notif.is_read ? 600 : 700}
                          >
                            {notif.title}
                          </Typography>

                          {!notif.is_read && (
                            <Chip
                              label="New"
                              color="primary"
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: 9,
                                fontWeight: 700,
                              }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                          <Typography
                            component="div"
                            variant="body2"
                            color="text.primary"
                          >
                            {notif.message}
                          </Typography>

                          <Typography
                            component="div"
                            variant="caption"
                            color="text.secondary"
                          >
                            {formatDate(notif.created_at)}
                          </Typography>
                        </Stack>
                      }
                      slotProps={{
                        secondary: {
                          component: 'div',
                        },
                      }}
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
