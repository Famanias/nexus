'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Avatar, Chip,
  IconButton, Tooltip, TextField, InputAdornment, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, Alert, CircularProgress, Switch, FormControlLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Block as BlockIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole, Invitation } from '@/types';
import { roleLabel, formatDate } from '@/lib/utils/format';
import { useToast } from '@/lib/context/ToastContext';
import { syncUserRoleMetadata } from '@/actions/users';

interface UserFormData {
  full_name: string;
  email: string;
  role: UserRole;
  department: string;
  required_hours: number;
  is_active: boolean;
}

const defaultForm: UserFormData = {
  full_name: '',
  email: '',
  role: 'ojt',
  department: '',
  required_hours: 600,
  is_active: true,
};

interface DisplayRow {
  isInvite: boolean;
  inviteId?: string;
  profileId?: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  required_hours: string;
  date: string;
  status: string;
  statusColor: 'default' | 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'success';
  rawStatus: string;
  isActive: boolean;
}

interface UsersClientProps {
  initialUsers: Profile[];
  initialInvitations?: Invitation[];
}

export default function UsersClient({
  initialUsers,
  initialInvitations = [],
}: UsersClientProps) {
  const [users, setUsers] = useState<Profile[]>(initialUsers);
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const toast = useToast();
  
  // Edit Profile Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<UserFormData>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<Profile | null>(null);

  // Invite Dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('ojt');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Revoke Dialog state
  const [revokeDialog, setRevokeDialog] = useState<DisplayRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setUsers(data);

    try {
      const res = await fetch('/api/invitations');
      if (res.ok) {
        const json = await res.json();
        setInvitations(json.invitations ?? []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  const initialMountRef = React.useRef(false);
  useEffect(() => {
    if (!initialMountRef.current) {
      initialMountRef.current = true;
      if (initialUsers && initialUsers.length > 0) {
        return;
      }
    }
    fetchUsers();
  }, [fetchUsers, initialUsers]);


  const openInvite = () => {
    setInviteEmail('');
    setInviteRole('ojt');
    setInviteError('');
    setInviteDialogOpen(true);
  };

  const handleInviteSubmit = async () => {
    setInviteSubmitting(true);
    setInviteError('');

    if (!inviteEmail) {
      setInviteError('Email is required.');
      setInviteSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error ?? 'Failed to send invitation.');
      } else {
        if (json.warning) {
          toast.showWarning(json.warning);
        } else {
          toast.showSuccess('Invitation sent successfully!');
        }
        setInviteDialogOpen(false);
        fetchUsers();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setInviteError(msg || 'An error occurred.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const openEdit = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department: user.department ?? '',
      required_hours: user.required_hours,
      is_active: user.is_active,
    });
    setError('');
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    setSubmitting(true);
    setError('');

    if (!formData.full_name) {
      setError('Full name is required.');
      setSubmitting(false);
      return;
    }

    if (editingUser) {
      // Update profile
      const updateData: Record<string, unknown> = {
        full_name: formData.full_name,
        role: formData.role,
        system_role: formData.role,
        department: formData.department || null,
        is_active: formData.is_active,
      };

      if (formData.role === 'ojt') {
        updateData.required_hours = formData.required_hours;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', editingUser.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        const { error: syncError } = await syncUserRoleMetadata(editingUser.id, formData.role);
        if (syncError) {
          toast.showWarning(`Profile updated, but role sync failed: ${syncError}`);
        } else {
          toast.showSuccess('User updated successfully.');
        }
        setEditDialogOpen(false);
        fetchUsers();
      }
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    const { error: deleteError } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', deleteDialog.id);

    if (!deleteError) {
      toast.showSuccess('User deactivated.');
      fetchUsers();
    } else {
      toast.showError('Failed to deactivate user.');
    }
    setDeleteDialog(null);
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/invitations/${inviteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend' }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.showError(json.error ?? 'Failed to resend invitation.');
      } else {
        if (json.warning) {
          toast.showWarning(json.warning);
        } else {
          toast.showSuccess('Invitation resent successfully!');
        }
        fetchUsers();
      }
    } catch (err: unknown) {
      console.error(err);
      toast.showError('An unexpected error occurred while resending the invitation.');
    }
  };

  const handleRevokeInvite = async () => {
    if (!revokeDialog || !revokeDialog.inviteId) return;

    try {
      setRevoking(true);
      const res = await fetch(`/api/invitations/${revokeDialog.inviteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json();
        toast.showError(json.error ?? 'Failed to revoke invitation.');
      } else {
        toast.showSuccess('Invitation revoked successfully.');
        fetchUsers();
      }
    } catch (err: unknown) {
      console.error(err);
      toast.showError('An unexpected error occurred while revoking the invitation.');
    } finally {
      setRevoking(false);
      setRevokeDialog(null);
    }
  };

  // Compile unified display rows
  const displayRows: DisplayRow[] = [];

  // Add profile rows
  users.forEach((u) => {
    displayRows.push({
      isInvite: false,
      profileId: u.id,
      name: u.full_name,
      email: u.email,
      role: u.role,
      department: u.department ?? '—',
      required_hours: u.role === 'ojt' ? `${u.required_hours}h` : '—',
      date: formatDate(u.created_at),
      status: u.is_active ? 'Active' : 'Inactive',
      statusColor: u.is_active ? 'success' : 'default',
      rawStatus: u.is_active ? 'active' : 'inactive',
      isActive: u.is_active,
    });
  });

  // Add invitation rows
  invitations.forEach((inv) => {
    if (inv.status === 'accepted') return; // Profile already exists

    let statusText = 'Pending Invite';
    let statusColor: DisplayRow['statusColor'] = 'warning';

    if (inv.status === 'expired') {
      statusText = 'Expired Invite';
      statusColor = 'error';
    } else if (inv.status === 'revoked') {
      statusText = 'Revoked Invite';
      statusColor = 'default';
    }

    displayRows.push({
      isInvite: true,
      inviteId: inv.id,
      name: 'Pending Invitee',
      email: inv.email,
      role: inv.role,
      department: '—',
      required_hours: '—',
      date: formatDate(inv.created_at),
      status: statusText,
      statusColor: statusColor,
      rawStatus: inv.status,
      isActive: false,
    });
  });

  const filtered = displayRows.filter((row) => {
    const matchSearch =
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || row.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleColor: Record<string, 'default' | 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'success'> = {
    ojt: 'default',
    supervisor: 'primary',
    admin: 'error',
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>User Management</Typography>
          <Typography color="text.secondary">Invite and manage OJTs, supervisors, and admins.</Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={openInvite}>
          Invite User
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Role</InputLabel>
            <Select value={roleFilter} label="Role" onChange={(e) => setRoleFilter(e.target.value)}>
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="ojt">OJT</MenuItem>
              <MenuItem value="supervisor">Supervisor</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {filtered.length} users
          </Typography>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Department</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Required Hours</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Joined / Invited</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: 'text.primary' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((row, idx) => (
                <TableRow
                  key={row.isInvite ? `invite-${row.inviteId}-${idx}` : `profile-${row.profileId}`}
                  sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 38, height: 38, bgcolor: row.isInvite ? '#94a3b8' : 'primary.main' }}>
                        {row.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.email}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={roleLabel(row.role)} color={roleColor[row.role]} size="small" />
                  </TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>{row.required_hours}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>
                    <Chip
                      label={row.status}
                      color={row.statusColor}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {row.isInvite ? (
                      <>
                        {row.rawStatus !== 'revoked' && (
                          <Tooltip title="Revoke Invitation">
                            <IconButton size="small" color="error" onClick={() => setRevokeDialog(row)}>
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {row.rawStatus !== 'accepted' && (
                          <Tooltip title="Resend Invitation">
                            <IconButton size="small" color="primary" onClick={() => handleResendInvite(row.inviteId!)}>
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    ) : (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => {
                            const originalUser = users.find(u => u.id === row.profileId);
                            if (originalUser) openEdit(originalUser);
                          }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Deactivate">
                          <IconButton size="small" color="error" onClick={() => {
                            const originalUser = users.find(u => u.id === row.profileId);
                            if (originalUser) setDeleteDialog(originalUser);
                          }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Invite New User</DialogTitle>
        <DialogContent dividers>
          {inviteError && <Alert severity="error" sx={{ mb: 2 }}>{inviteError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth label="Email Address" type="email" required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={inviteRole}
                  label="Role"
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                >
                  <MenuItem value="ojt">OJT</MenuItem>
                  <MenuItem value="supervisor">Supervisor</MenuItem>
                  <MenuItem value="admin">System Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleInviteSubmit}
            disabled={inviteSubmitting}
            startIcon={inviteSubmitting ? <CircularProgress size={16} /> : <SendIcon />}
          >
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Edit User</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth label="Full Name" required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth label="Email" type="email"
                value={formData.email}
                disabled
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                >
                  <MenuItem value="ojt">OJT</MenuItem>
                  <MenuItem value="supervisor">Supervisor</MenuItem>
                  <MenuItem value="admin">System Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label="Department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </Grid>
            {formData.role === 'ojt' && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth label="Required Hours" type="number"
                  value={formData.required_hours}
                  onChange={(e) => setFormData({ ...formData, required_hours: Number(e.target.value) })}
                  inputProps={{ min: 1 }}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEditSubmit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)}>
        <DialogTitle fontWeight={700}>Deactivate User?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate <strong>{deleteDialog?.full_name}</strong>?
            They will no longer be able to log in.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke Invitation Confirm Dialog */}
      <Dialog open={!!revokeDialog} onClose={() => setRevokeDialog(null)}>
        <DialogTitle fontWeight={700}>Revoke Invitation?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revoke the invitation for <strong>{revokeDialog?.email}</strong>?
            They will no longer be able to use the invitation link.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeDialog(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleRevokeInvite}>
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
