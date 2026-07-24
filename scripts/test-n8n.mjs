#!/usr/bin/env node

/**
 * ============================================================
 * n8n Workflows Test Runner Script (v2 Engine)
 * ============================================================
 * Dispatches test domain event envelopes to the n8n Master Router
 * webhook ingress (/webhook/events) and validates execution responses.
 *
 * Usage:
 *   node scripts/test-n8n.mjs [--dry-run] [--verbose] [--domain=kanban] [--event=user.invited]
 *   npm run test:workflows
 * ============================================================
 * 
 * How to Use the Test Runner
 * 1. Run all domain workflow tests
 * npm run test:workflows
 * 2. Run in Dry-Run mode (inspect payloads without sending HTTP requests) 
 * npm run test:workflows -- --dry-run
 * or
 * node scripts/test-n8n.mjs --dry-run
 * 3. Run with verbose details (prints full HTTP headers & payload JSON)
 * node scripts/test-n8n.mjs --dry-run --verbose
 * 4. Filter tests by domain or event name
 * # Test only Kanban domain events (task.created, task.assigned, task.completed)
 * node scripts/test-n8n.mjs --domain=kanban
 *
 * # Test a single specific event
 * node scripts/test-n8n.mjs --event=user.invited
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Command line arguments parsing
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

const domainArg = args.find((a) => a.startsWith('--domain='))?.split('=')[1]?.toLowerCase();
const eventArg = args.find((a) => a.startsWith('--event='))?.split('=')[1]?.toLowerCase();

// Auto-load .env.local and .env files
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile(path.join(ROOT_DIR, '.env.local'));
loadEnvFile(path.join(ROOT_DIR, '.env'));

const n8nHost = (process.env.N8N_HOST || process.env.N8N_URL || 'http://localhost:5678').replace(/\/+$/, '');
const n8nApiKey = process.env.N8N_API_KEY || 'test_api_key_placeholder';
const webhookUrl = `${n8nHost}/webhook/events`;

// Sample Test Events Suite across all 5 v2 Domains
const testSuites = [
  // 1. USERS DOMAIN
  {
    domain: 'users',
    event: 'user.created',
    description: 'User Created -> Welcome Email API',
    payload: {
      id: `evt_test_user_created_${Date.now()}`,
      event: 'user.created',
      actorId: 'usr_test_admin_001',
      organizationId: 'org_test_acme_001',
      payload: {
        userId: 'usr_new_intern_001',
        email: 'test.intern@example.com',
        name: 'Alex Rivera',
        role: 'ojt',
      },
      timestamp: new Date().toISOString(),
    },
  },
  {
    domain: 'users',
    event: 'user.invited',
    description: 'User Invited -> Invitation Email API',
    payload: {
      id: `evt_test_user_invited_${Date.now()}`,
      event: 'user.invited',
      actorId: 'usr_test_supervisor_001',
      organizationId: 'org_test_acme_001',
      payload: {
        email: 'invited.candidate@example.com',
        orgName: 'Acme Software Labs',
        inviteUrl: 'https://nexxus.lol/invite/token_test_12345',
      },
      timestamp: new Date().toISOString(),
    },
  },
  {
    domain: 'users',
    event: 'user.deleted',
    description: 'User Deleted -> Slack & Discord Alerts',
    payload: {
      id: `evt_test_user_deleted_${Date.now()}`,
      event: 'user.deleted',
      actorId: 'usr_test_admin_001',
      organizationId: 'org_test_acme_001',
      payload: {
        userId: 'usr_terminated_001',
        email: 'departed.user@example.com',
      },
      timestamp: new Date().toISOString(),
    },
  },

  // 2. KANBAN DOMAIN
  {
    domain: 'kanban',
    event: 'task.created',
    description: 'Task Created -> Slack & Discord Alerts',
    payload: {
      id: `evt_test_task_created_${Date.now()}`,
      event: 'task.created',
      actorId: 'usr_test_supervisor_001',
      organizationId: 'org_test_acme_001',
      payload: {
        taskId: 'task_kanban_101',
        title: 'Implement Multi-Tenant Webhook Verification',
        priority: 'high',
      },
      timestamp: new Date().toISOString(),
    },
  },
  {
    domain: 'kanban',
    event: 'task.assigned',
    description: 'Task Assigned -> Assignment Email API',
    payload: {
      id: `evt_test_task_assigned_${Date.now()}`,
      event: 'task.assigned',
      actorId: 'usr_test_supervisor_001',
      organizationId: 'org_test_acme_001',
      payload: {
        taskId: 'task_kanban_101',
        title: 'Implement Multi-Tenant Webhook Verification',
        assigneeId: 'usr_intern_alex_001',
        assigneeEmail: 'test.intern@example.com',
      },
      timestamp: new Date().toISOString(),
    },
  },
  {
    domain: 'kanban',
    event: 'task.completed',
    description: 'Task Completed -> Slack & Discord Review Alerts',
    payload: {
      id: `evt_test_task_completed_${Date.now()}`,
      event: 'task.completed',
      actorId: 'usr_intern_alex_001',
      organizationId: 'org_test_acme_001',
      payload: {
        taskId: 'task_kanban_101',
        title: 'Implement Multi-Tenant Webhook Verification',
        completedBy: 'Alex Rivera',
      },
      timestamp: new Date().toISOString(),
    },
  },

  // 3. ATTENDANCE DOMAIN
  {
    domain: 'attendance',
    event: 'attendance.late',
    description: 'Late Attendance -> Slack & Discord Late Alerts',
    payload: {
      id: `evt_test_att_late_${Date.now()}`,
      event: 'attendance.late',
      actorId: 'usr_intern_alex_001',
      organizationId: 'org_test_acme_001',
      payload: {
        studentName: 'Alex Rivera',
        checkInTime: '09:45 AM',
        thresholdTime: '09:00 AM',
      },
      timestamp: new Date().toISOString(),
    },
  },
  {
    domain: 'attendance',
    event: 'attendance.absent',
    description: 'Absence Flagged -> Slack & Discord Absence Alerts',
    payload: {
      id: `evt_test_att_absent_${Date.now()}`,
      event: 'attendance.absent',
      actorId: 'sys_cron_worker',
      organizationId: 'org_test_acme_001',
      payload: {
        studentName: 'Alex Rivera',
        date: new Date().toISOString().split('T')[0],
      },
      timestamp: new Date().toISOString(),
    },
  },

  // 4. REPORTS DOMAIN
  {
    domain: 'reports',
    event: 'report.submitted',
    description: 'Report Submitted -> Slack & Discord Review Alerts',
    payload: {
      id: `evt_test_report_sub_${Date.now()}`,
      event: 'report.submitted',
      actorId: 'usr_intern_alex_001',
      organizationId: 'org_test_acme_001',
      payload: {
        reportId: 'rp_week_4_001',
        title: 'Week 4 OJT Activity & Hours Summary',
        authorName: 'Alex Rivera',
      },
      timestamp: new Date().toISOString(),
    },
  },
  {
    domain: 'reports',
    event: 'report.approved',
    description: 'Report Approved -> Approved Email API',
    payload: {
      id: `evt_test_report_app_${Date.now()}`,
      event: 'report.approved',
      actorId: 'usr_test_supervisor_001',
      organizationId: 'org_test_acme_001',
      payload: {
        reportId: 'rp_week_4_001',
        title: 'Week 4 OJT Activity & Hours Summary',
        internEmail: 'test.intern@example.com',
      },
      timestamp: new Date().toISOString(),
    },
  },

  // 5. ORGANIZATIONS DOMAIN
  {
    domain: 'organizations',
    event: 'organization.created',
    description: 'Organization Created -> Slack & Discord Org Alerts',
    payload: {
      id: `evt_test_org_created_${Date.now()}`,
      event: 'organization.created',
      actorId: 'usr_test_admin_001',
      organizationId: 'org_test_acme_001',
      payload: {
        orgId: 'org_test_acme_001',
        name: 'Acme Software Labs',
      },
      timestamp: new Date().toISOString(),
    },
  },
];

async function runTestRunner() {
  console.log('\n🧪 ============================================================');
  console.log('🧪 Nexus n8n Workflow Automation Test Runner (v2 Engine)');
  console.log('🧪 ============================================================');
  console.log(`📡 Ingress Target Webhook : ${webhookUrl}`);
  if (isDryRun) {
    console.log('ℹ️  Running in DRY-RUN mode — payloads will be logged without sending HTTP requests.');
  }

  // Filter test suites based on CLI flags
  let filteredSuites = testSuites;
  if (domainArg) {
    filteredSuites = filteredSuites.filter((item) => item.domain === domainArg);
    console.log(`🔍 Filtered by Domain: "${domainArg}" (${filteredSuites.length} test cases)`);
  }
  if (eventArg) {
    filteredSuites = filteredSuites.filter((item) => item.event.toLowerCase() === eventArg);
    console.log(`🔍 Filtered by Event: "${eventArg}" (${filteredSuites.length} test cases)`);
  }

  if (filteredSuites.length === 0) {
    console.log('⚠️ No test cases matched your filter options.');
    return;
  }

  console.log(`\n🚀 Executing ${filteredSuites.length} test case(s)...\n`);

  const results = [];

  for (let i = 0; i < filteredSuites.length; i++) {
    const testCase = filteredSuites[i];
    const indexStr = `[${i + 1}/${filteredSuites.length}]`;
    const label = `${testCase.event} (${testCase.description})`;

    if (isDryRun) {
      console.log(`🔹 ${indexStr} [DRY RUN] ${label}`);
      if (isVerbose) {
        console.log(`   Headers: X-Automation-Key: ${n8nApiKey.slice(0, 8)}...`);
        console.log(`   Payload:`, JSON.stringify(testCase.payload, null, 2));
      }
      results.push({ event: testCase.event, domain: testCase.domain, status: 'SKIPPED (DRY RUN)', statusCode: 200, durationMs: 0 });
      continue;
    }

    const startTime = Date.now();
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Automation-Key': n8nApiKey,
          'X-Event-Name': testCase.event,
          'X-Event-Id': testCase.payload.id,
        },
        body: JSON.stringify(testCase.payload),
      });

      const durationMs = Date.now() - startTime;
      const ok = response.ok;
      const resText = await response.text().catch(() => '');

      if (ok) {
        console.log(`  ✅ ${indexStr} PASSED ${label} (${response.status} OK - ${durationMs}ms)`);
        if (isVerbose && resText) {
          console.log(`     Response: ${resText}`);
        }
        results.push({ event: testCase.event, domain: testCase.domain, status: 'PASSED', statusCode: response.status, durationMs });
      } else {
        console.log(`  ❌ ${indexStr} FAILED ${label} (${response.status} ${response.statusText} - ${durationMs}ms)`);
        console.log(`     Error body: ${resText}`);
        results.push({ event: testCase.event, domain: testCase.domain, status: 'FAILED', statusCode: response.status, durationMs, error: resText });
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${indexStr} ERROR ${label} (${errMsg} - ${durationMs}ms)`);
      results.push({ event: testCase.event, domain: testCase.domain, status: 'ERROR', statusCode: 0, durationMs, error: errMsg });
    }
  }

  // Final Summary Table
  console.log('\n📊 ============================================================');
  console.log('📊 n8n Workflow Test Execution Summary');
  console.log('📊 ============================================================');

  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  const failedCount = results.filter((r) => r.status === 'FAILED' || r.status === 'ERROR').length;
  const skippedCount = results.filter((r) => r.status.includes('SKIPPED')).length;

  console.log(`Total Test Cases : ${results.length}`);
  console.log(`Passed           : ${passedCount}`);
  console.log(`Failed           : ${failedCount}`);
  if (skippedCount > 0) {
    console.log(`Skipped          : ${skippedCount}`);
  }

  if (failedCount > 0) {
    console.log('\n❌ Workflow Test Suite Failed!');
    process.exit(1);
  } else {
    console.log('\n✨ All Workflow Test Cases Executed Successfully!\n');
  }
}

runTestRunner().catch((err) => {
  console.error('\n❌ Test runner execution failed:', err);
  process.exit(1);
});
