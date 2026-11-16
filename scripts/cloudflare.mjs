#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const action = process.argv[2];
if (existsSync(new URL('.env', root))) process.loadEnvFile(fileURLToPath(new URL('.env', root)));
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const localConfig = new URL('wrangler.local.jsonc', root);
const clean = value => token ? value.toString().split(token).join('[REDACTED]') : value.toString();

async function wrangler(args) {
  const config = existsSync(localConfig) ? ['--config', fileURLToPath(localConfig)] : [];
  const child = spawn(process.execPath, [fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js', root)), ...args, ...config], {
    cwd: fileURLToPath(root),
    env: { ...process.env, ...(account ? { CLOUDFLARE_ACCOUNT_ID: account } : {}), WRANGLER_SEND_METRICS: 'false' },
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  child.stdout.on('data', data => process.stdout.write(clean(data)));
  child.stderr.on('data', data => process.stderr.write(clean(data)));
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Wrangler exited with ${code}`)));
  });
}

if (action === 'dry-run') await wrangler(['deploy', '--dry-run']);
else if (action === 'deploy') {
  if (!account || !token) throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in ignored .env.');
  await wrangler(['deploy']);
} else if (action === 'whoami') await wrangler(['whoami']);
else throw new Error('Usage: node scripts/cloudflare.mjs dry-run|deploy|whoami');
