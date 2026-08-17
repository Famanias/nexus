import { format } from 'date-fns';
import { PRIORITY_COLORS } from '@/lib/constants/theme';

export function formatDate(dateString: string): string {
  return format(new Date(dateString), 'MMM dd, yyyy');
}

export function formatDateTime(dateString: string): string {
  return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
}

export function formatTime(dateString: string): string {
  return format(new Date(dateString), 'hh:mm a');
}

export function formatHours(hours: number): string {
  if (!hours || hours === 0) return '0h 0m';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function getFileType(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    ojt: 'OJT',
    supervisor: 'Supervisor',
    admin: 'System Admin',
  };
  return labels[role] ?? role;
}

export function priorityColor(priority: string): string {
  const colors = PRIORITY_COLORS as Record<string, string>;
  return colors[priority] ?? colors.default;
}
