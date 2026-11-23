import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface BountyManifest {
  bounties: string[];
}

const MAX_MANIFEST_BYTES = 16384;
const MAX_BOUNTY_ITEMS = 100;
const MAX_ITEM_LENGTH = 2048;

function validateItem(entry: unknown, index: number): string {
  if (typeof entry !== 'string') {
    throw new Error(`bounties[${index}] must be a string`);
  }
  const trimmed = entry.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ITEM_LENGTH) {
    throw new Error(`bounties[${index}] has invalid length (${trimmed.length})`);
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.endsWith('make.fun')) {
      throw new Error(`bounties[${index}] must point to make.fun`);
    }
  }
  return trimmed;
}

function readManifest(sourcePath: string): { raw: Buffer; parsed: BountyManifest } {
  const raw = readFileSync(sourcePath);
  if (raw.byteLength === 0 || raw.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error(`Invalid BOUNTY.json size: ${raw.byteLength} bytes`);
  }
  const data = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
  if ('url' in data && 'bounties' in data) {
    throw new Error('BOUNTY.json must not declare both url and bounties');
  }
  if (!Array.isArray(data.bounties) || data.bounties.length === 0 || data.bounties.length > MAX_BOUNTY_ITEMS) {
    throw new Error('BOUNTY.json must contain a non-empty bounties array (1..100 items)');
  }
  const validated = data.bounties.map((entry, idx) => validateItem(entry, idx));
  return { raw, parsed: { bounties: validated } };
}

function main(): void {
  const botDir = resolve(process.env.MAKEFUN_BOT_DIR || '/bot');
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
  const sourceFile = join(botDir, 'BOUNTY.json');
  const targetFile = join(outDir, 'BOUNTY.json');

  const { raw } = readManifest(sourceFile);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(targetFile, raw);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`bounty-entrants-03 runner error: ${message}`);
  process.exit(1);
}
