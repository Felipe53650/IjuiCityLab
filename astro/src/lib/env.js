import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function cleanValue(raw) {
  let value = raw.trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
    if (quote === '"') {
      value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    return value;
  }
  const commentAt = value.search(/\s#/);
  if (commentAt >= 0) value = value.slice(0, commentAt).trim();
  return value;
}

export function loadEnv() {
  const file = path.join(projectRoot, '.env');
  if (!fs.existsSync(file)) return;

  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] === undefined) {
      process.env[key] = cleanValue(value);
    }
  }
}

loadEnv();
