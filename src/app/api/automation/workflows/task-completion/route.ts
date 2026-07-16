// ============================================================
// Automation Workflow — Task Completion Email
// ============================================================
// Triggered by n8n when a task.completed event is received.
// Sends an email via Resend to the task creator.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import React from 'react';
import TaskCompletedEmail from '@/emails/TaskCompletedEmail';
import { automationLogger } from '@/lib/automation/logger';
import { parseAutomationRequest } from '@/lib/automation/workflow-request';
import { TaskCompletedPayload } from '@/lib/automation/types';

export async function POST(request: NextRequest) {
  try {
    const automationOrResponse = await parseAutomationRequest<TaskCompletedPayload>(request, [
      'title', 'completedBy'
    ]);

    // If it returned a NextResponse, it means validation failed
    if (automationOrResponse instanceof NextResponse) {
      return automationOrResponse;
    }

    const { title, completedBy, creatorEmail, creatorName } = automationOrResponse.payload;

    if (!creatorEmail) {
      automationLogger.warn('TaskCompletionWorkflow', 'No creator email provided in payload — skipping email');
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'No creator email',
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || resendApiKey === 'placeholder' || resendApiKey.startsWith('your_')) {
      automationLogger.warn('TaskCompletionWorkflow', 'Resend API key not configured — skipping email');
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Resend API key not configured',
      });
    }

    const resend = new Resend(resendApiKey);
    const emailFrom = process.env.EMAIL_FROM || 'Nexus <noreply@nexxus.lol>';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexxus.lol';

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: creatorEmail,
      subject: `Task Completed: ${title}`,
      react: React.createElement(TaskCompletedEmail, {
        creatorName: creatorName || 'Supervisor',
        taskTitle: title,
        completedByName: completedBy,
        taskUrl: `${siteUrl}/dashboard/kanban`,
      }),
    });

    if (error) {
      automationLogger.error('TaskCompletionWorkflow', `Failed to send task completion email: ${error.message}`, { email: creatorEmail });
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    automationLogger.info('TaskCompletionWorkflow', `Task completion email sent to ${creatorEmail}`, { messageId: data?.id });
    return NextResponse.json({ success: true, messageId: data?.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    automationLogger.error('TaskCompletionWorkflow', `Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
