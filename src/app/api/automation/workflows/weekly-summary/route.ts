// ============================================================
// Automation Workflow — Weekly Supervisor Summary
// ============================================================
// Triggered by n8n on a cron schedule (every Friday).
// Generates and sends weekly OJT summary reports to
// supervisors and admins.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { Resend } from 'resend';
import React from 'react';
import WeeklySummaryEmail from '@/emails/WeeklySummaryEmail';
import { automationLogger } from '@/lib/automation/logger';
import { parseAutomationRequest } from '@/lib/automation/workflow-request';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { completionPercent } from '@/lib/attendance/summary';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseAdmin(url, key);
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export async function POST(request: NextRequest) {
  const automationOrResponse = await parseAutomationRequest(request);
  if (automationOrResponse instanceof NextResponse) {
    return automationOrResponse;
  }

  try {
    const supabaseAdmin = getAdminClient();

    // Calculate the week range (Monday–Friday of the current week,
    // or the previous week if triggered on Friday)
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekStartFormatted = format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM dd');
    const weekEndFormatted = format(endOfWeek(now, { weekStartsOn: 1 }), 'MMM dd, yyyy');

    // 1. Get all organizations
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name');

    if (!orgs || orgs.length === 0) {
      automationLogger.info('WeeklySummary', 'No organizations found');
      return NextResponse.json({ success: true, summaries_sent: 0 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || resendApiKey === 'placeholder' || resendApiKey.startsWith('your_')) {
      automationLogger.warn('WeeklySummary', 'Resend API key not configured — skipping emails');
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Resend API key not configured',
      });
    }

    const resend = new Resend(resendApiKey);
    const emailFrom = process.env.EMAIL_FROM || 'Nexus <onboarding@nexxus.lol>';
    let totalSent = 0;
    let totalFailed = 0;

    for (const org of orgs) {
      // 2. Get supervisors and admins for this org
      const { data: supervisors } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('org_id', org.id)
        .in('role', ['admin', 'supervisor'])
        .eq('is_active', true);

      if (!supervisors || supervisors.length === 0) continue;

      // 3. Get OJTs for this org
      const { data: ojts } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, required_hours')
        .eq('org_id', org.id)
        .eq('role', 'ojt')
        .eq('is_active', true);

      if (!ojts || ojts.length === 0) continue;

      // 4. Get attendance for this week
      const { data: weekAttendance } = await supabaseAdmin
        .from('attendance')
        .select('user_id, total_hours, date')
        .in('user_id', ojts.map((o) => o.id))
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .not('total_hours', 'is', null);

      // 5. Get all-time attendance for progress calculation
      const { data: allAttendance } = await supabaseAdmin
        .from('attendance')
        .select('user_id, total_hours')
        .in('user_id', ojts.map((o) => o.id))
        .not('total_hours', 'is', null);

      // 6. Get pending tasks
      const { data: pendingTasks } = await supabaseAdmin
        .from('task_assignees')
        .select('user_id')
        .in('user_id', ojts.map((o) => o.id))
        .eq('status', 'accepted');

      // 7. Build OJT summary rows
      const ojtSummaries = ojts.map((ojt) => {
        const weekHours = (weekAttendance ?? [])
          .filter((a) => a.user_id === ojt.id)
          .reduce((sum, a) => sum + (a.total_hours ?? 0), 0);
        const weekDays = (weekAttendance ?? [])
          .filter((a) => a.user_id === ojt.id)
          .length;
        const totalHoursAll = (allAttendance ?? [])
          .filter((a) => a.user_id === ojt.id)
          .reduce((sum, a) => sum + (a.total_hours ?? 0), 0);
        const taskCount = (pendingTasks ?? [])
          .filter((t) => t.user_id === ojt.id).length;
        const completionPct = completionPercent(totalHoursAll, ojt.required_hours);

        return {
          fullName: ojt.full_name,
          totalHours: formatHours(weekHours),
          daysPresent: weekDays,
          pendingTasks: taskCount,
          completionPct: `${completionPct.toFixed(0)}%`,
        };
      });

      // 8. Calculate average attendance rate
      const totalPossibleDays = ojts.length * 5; // 5 weekdays
      const totalActualDays = ojtSummaries.reduce((sum, o) => sum + o.daysPresent, 0);
      const avgRate = totalPossibleDays > 0
        ? `${((totalActualDays / totalPossibleDays) * 100).toFixed(0)}%`
        : '0%';

      // 9. Send to each supervisor/admin
      for (const supervisor of supervisors) {
        try {
          const { error: emailError } = await resend.emails.send({
            from: emailFrom,
            to: supervisor.email,
            subject: `Weekly OJT Summary — ${org.name} (${weekStartFormatted} – ${weekEndFormatted})`,
            react: React.createElement(WeeklySummaryEmail, {
              supervisorName: supervisor.full_name,
              supervisorEmail: supervisor.email,
              orgName: org.name,
              weekStartDate: weekStartFormatted,
              weekEndDate: weekEndFormatted,
              totalOjts: ojts.length,
              avgAttendanceRate: avgRate,
              ojts: ojtSummaries,
            }),
          });

          if (emailError) {
            automationLogger.error('WeeklySummary', `Failed to send to ${supervisor.email}: ${emailError.message}`);
            totalFailed++;
          } else {
            totalSent++;
          }
        } catch (err) {
          automationLogger.error('WeeklySummary', `Exception sending to ${supervisor.email}: ${err}`);
          totalFailed++;
        }
      }
    }

    automationLogger.info('WeeklySummary', `Weekly summaries sent: ${totalSent}, failed: ${totalFailed}`);

    return NextResponse.json({
      success: true,
      summaries_sent: totalSent,
      summaries_failed: totalFailed,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    automationLogger.error('WeeklySummary', `Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
