#!/usr/bin/env node

/**
 * ============================================================
 * Export Deployed n8n Workflows Script
 * ============================================================
 * Fetches all currently active/deployed workflows from your n8n
 * instance via REST API and exports them as JSON files.
 *
 * Usage:
 *   node scripts/export-n8n.mjs [output-dir]
 * ============================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Auto-load .env.local and .env
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

const n8nHost = (process.env.N8N_HOST || process.env.N8N_URL || '').replace(/\/+$/, '');
const n8nApiKey = process.env.N8N_API_KEY || '';
const targetDirArg = process.argv[2] || 'workflows/exported';
const exportDir = path.resolve(ROOT_DIR, targetDirArg);

if (!n8nHost || !n8nApiKey) {
  console.error('\n⚠️ N8N_HOST (or N8N_URL) and N8N_API_KEY are required in environment or .env.local');
  process.exit(1);
}

async function exportWorkflows() {
  console.log(`\n📥 Connecting to n8n at ${n8nHost}...`);

  const listRes = await fetch(`${n8nHost}/api/v1/workflows`, {
    headers: { 'X-N8N-API-KEY': n8nApiKey }
  });

  if (!listRes.ok) {
    const err = await listRes.text();
    if (listRes.status === 401) {
      throw new Error(
        `401 Unauthorized: The N8N_API_KEY in your .env.local is invalid or expired.\n` +
        `   👉 To fix this:\n` +
        `   1. Log into your n8n Dashboard at ${n8nHost}\n` +
        `   2. Go to Settings -> Public API\n` +
        `   3. Click "Create API Key" and copy the key\n` +
        `   4. Update N8N_API_KEY="..." in your .env.local file`
      );
    }
    throw new Error(`Failed to list workflows (${listRes.status}): ${err}`);
  }

  const data = await listRes.json();
  const workflows = data.data || (Array.isArray(data) ? data : []);

  if (workflows.length === 0) {
    console.log('ℹ️ No deployed workflows found in n8n instance.');
    return;
  }

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  console.log(`📡 Found ${workflows.length} deployed workflow(s). Exporting to "${targetDirArg}"...\n`);

  for (const wfSummary of workflows) {
    const detailRes = await fetch(`${n8nHost}/api/v1/workflows/${wfSummary.id}`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    });

    if (!detailRes.ok) {
      console.warn(`⚠️ Could not fetch workflow ID ${wfSummary.id}: ${detailRes.statusText}`);
      continue;
    }

    const wfDetail = await detailRes.json();
    const safeName = (wfDetail.name || `workflow_${wfSummary.id}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const fileName = `${safeName}.json`;
    const filePath = path.join(exportDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(wfDetail, null, 2), 'utf-8');
    console.log(`  ✅ Exported "${wfDetail.name}" (ID: ${wfDetail.id}) -> ${targetDirArg}/${fileName}`);
  }

  console.log(`\n✨ Export complete! All workflows saved to ${exportDir}\n`);
}

exportWorkflows().catch((err) => {
  console.error('\n❌ Export failed:', err.message);
  process.exit(1);
});
