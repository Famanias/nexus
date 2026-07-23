import { createClient } from '@/lib/supabase/server';
import { KanbanColumn, Profile, TaskAssigneeDetail } from '@/types';
import KanbanBoardClient from '@/components/kanban/KanbanBoardClient';

export const dynamic = 'force-dynamic';

export default async function KanbanPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: cols }, { data: tasks }, { data: ojts }, { data: profile }] =
    await Promise.all([
      supabase.from('kanban_columns').select('*').order('position'),
      supabase.from('kanban_tasks').select(`
        *,
        assignee:profiles!kanban_tasks_assignee_id_fkey(id, full_name, avatar_url, role),
        task_assignees_raw:task_assignees(
          user_id,
          status,
          profile:profiles(id, full_name, avatar_url)
        ),
        attachments:task_attachments(*)
      `).order('position'),
      supabase.from('profiles').select('*').eq('role', 'ojt').eq('is_active', true),
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
    ]);

  let columnsData = cols ?? [];

  if (columnsData.length === 0 && user) {
    const orgId = (profile as Profile)?.org_id;
    const defaultCols = [
      { title: 'To Do', color: '#6366f1', position: 0, created_by: user.id, org_id: orgId || null },
      { title: 'In Progress', color: '#f59e0b', position: 1, created_by: user.id, org_id: orgId || null },
      { title: 'Done', color: '#22c55e', position: 2, created_by: user.id, org_id: orgId || null },
    ];
    const { data: insertedCols } = await supabase
      .from('kanban_columns')
      .insert(defaultCols)
      .select();
    if (insertedCols) {
      columnsData = insertedCols;
    }
  }

  type RawAssignee = { user_id: string; status: string; profile: Profile };
  const enrichedCols = columnsData.map((col) => ({
    ...col,
    tasks: (tasks ?? [])
      .filter((t: { column_id: string; completed_at?: string | null }) => t.column_id === col.id && !t.completed_at)
      .map((t: { task_assignees_raw?: RawAssignee[] }) => {
        const raw: RawAssignee[] = t.task_assignees_raw ?? [];
        const task_assignees_detail: TaskAssigneeDetail[] = raw.map((a) => ({
          user_id: a.user_id,
          status: a.status as 'pending' | 'accepted' | 'rejected',
          profile: a.profile,
        }));
        return {
          ...t,
          task_assignees_detail,
          assigned_ojts: task_assignees_detail
            .filter((a) => a.status === 'accepted')
            .map((a) => a.profile),
        };
      }),
  })) as KanbanColumn[];

  return (
    <KanbanBoardClient
      initialColumns={enrichedCols}
      initialOjts={(ojts ?? []) as Profile[]}
      initialProfile={profile as Profile}
    />
  );
}
