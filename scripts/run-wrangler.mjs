import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root = process.cwd();
const configHome = path.join(root, '.local', 'wrangler-config');
await mkdir(configHome, { recursive: true });
const cli = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, XDG_CONFIG_HOME: configHome, WRANGLER_SEND_METRICS: 'false' },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
