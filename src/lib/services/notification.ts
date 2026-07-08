import { SupabaseClient } from '@supabase/supabase-js';
import { Notification } from '@/types';

export async function createNotification(
  supabaseAdmin: SupabaseClient,
  params: {
    orgId: string;
    userId: string;
    title: string;
    message: string;
    type: string;
  }
): Promise<Notification> {
  const { orgId, userId, title, message, type } = params;

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      org_id: orgId,
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create notification.');
  }

  return data as Notification;
}

export async function notifyAdmins(
  supabaseAdmin: SupabaseClient,
  orgId: string,
  params: {
    title: string;
    message: string;
    type: string;
  }
): Promise<void> {
  // Find all admins in the organization
  const { data: admins, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'admin');

  if (error || !admins || admins.length === 0) return;

  const notificationsToInsert = admins.map((admin) => ({
    org_id: orgId,
    user_id: admin.id,
    title: params.title,
    message: params.message,
    type: params.type,
    is_read: false,
  }));

  await supabaseAdmin.from('notifications').insert(notificationsToInsert);
}

export async function listNotifications(
  supabase: SupabaseClient,
  userId: string
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list notifications: ${error.message}`);
  }

  return data as Notification[];
}

export async function markNotificationAsRead(
  supabase: SupabaseClient,
  notificationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
}

export async function markAllNotificationsAsRead(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
}
