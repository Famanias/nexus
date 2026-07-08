import { SupabaseClient } from '@supabase/supabase-js';

export interface ReorderColumnParam {
  id: string;
  position: number;
}

export interface ReorderTaskParam {
  id: string;
  column_id: string;
  position: number;
}

/**
 * Reorders columns in a single transaction via RPC
 */
export async function reorderColumns(
  supabase: SupabaseClient,
  columns: ReorderColumnParam[]
): Promise<void> {
  const { error } = await supabase.rpc('reorder_kanban_columns', {
    payload: columns,
  });

  if (error) {
    throw new Error(`Failed to reorder columns: ${error.message}`);
  }
}

/**
 * Reorders tasks in a single transaction via RPC
 */
export async function reorderTasks(
  supabase: SupabaseClient,
  tasks: ReorderTaskParam[]
): Promise<void> {
  const { error } = await supabase.rpc('reorder_kanban_tasks', {
    payload: tasks,
  });

  if (error) {
    throw new Error(`Failed to reorder tasks: ${error.message}`);
  }
}
