const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

// Read .env.local file to find connection string
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const connectionStringLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_CONNECTION_STRING='));

if (!connectionStringLine) {
  console.error('DATABASE_CONNECTION_STRING not found in .env.local');
  process.exit(1);
}

let connectionString = connectionStringLine.split('=')[1].trim();

const sql = `
-- Migration: Add require_location_verification to site_settings
alter table public.site_settings 
add column if not exists require_location_verification boolean not null default true;
`;

async function main() {
  // Let's resolve the host using dns.resolve6 if it contains db.ggqkqkfzivqhmrqqcrkc.supabase.co
  const hostMatch = connectionString.match(/@([^:/]+)/);
  if (hostMatch) {
    const host = hostMatch[1];
    console.log(`Resolving host: ${host}`);
    try {
      const addresses = await dns.resolve6(host);
      if (addresses && addresses.length > 0) {
        const ip = addresses[0];
        console.log(`Resolved ${host} to IPv6: ${ip}`);
        connectionString = connectionString.replace(host, `[${ip}]`);
      }
    } catch (err) {
      console.log(`Failed to resolve via DNS AAAA: ${err.message}. Trying direct connection...`);
    }
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Supabase DB.');
    await client.query(sql);
    console.log('Successfully added require_location_verification column!');
  } catch (err) {
    console.error('Error running SQL:', err);
  } finally {
    await client.end();
  }
}

main();
