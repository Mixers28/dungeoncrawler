#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd,
    encoding: options.encoding ?? 'buffer',
    stdio: ['ignore', 'pipe', options.silent ? 'ignore' : 'pipe'],
  });
}

function splitNull(buffer) {
  const value = buffer.toString('utf8');
  return value.length === 0 ? [] : value.slice(0, value.endsWith('\0') ? -1 : undefined).split('\0');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const gitToplevel = realpathSync(git(['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
const repositoryRoot = existsSync(join(gitToplevel, 'docs/PROJECT_CONTEXT.md'))
  ? gitToplevel
  : join(gitToplevel, 'dungeoncrawler');
for (const path of ['docs/PROJECT_CONTEXT.md', 'docs/NOW.md', 'docs/phased-plan.md']) {
  if (!existsSync(join(repositoryRoot, path))) throw new Error(`Not a Dungeon Portal repository: missing ${path}`);
}

function repositoryHead() {
  try {
    return git(['rev-parse', '--verify', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8', silent: true }).trim();
  } catch {
    return null;
  }
}

function workingEntry(path) {
  const absolutePath = join(repositoryRoot, path);
  if (!existsSync(absolutePath) && !lstatExists(absolutePath)) return { path, kind: 'missing' };
  const stat = lstatSync(absolutePath);
  const mode = (stat.mode & 0o7777).toString(8).padStart(4, '0');
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(absolutePath);
    return { path, kind: 'symlink', mode, target, digest: sha256(target) };
  }
  if (stat.isFile()) return { path, kind: 'file', mode, digest: sha256(readFileSync(absolutePath)) };
  if (stat.isDirectory()) return { path, kind: 'directory', mode, digest: submoduleState(absolutePath) };
  return { path, kind: 'other', mode };
}

function lstatExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function submoduleState(path) {
  try {
    const head = git(['rev-parse', '--verify', 'HEAD'], { cwd: path, encoding: 'utf8', silent: true }).trim();
    const status = git(['status', '--porcelain=v1', '-z'], { cwd: path }).toString('base64');
    return sha256(`${head}\0${status}`);
  } catch {
    return null;
  }
}

function buildManifest() {
  const paths = splitNull(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: repositoryRoot }))
    .sort((left, right) => left.localeCompare(right));
  const index = splitNull(git(['ls-files', '--stage', '-z'], { cwd: repositoryRoot })).sort();
  return { version: 1, head: repositoryHead(), index, entries: paths.map(workingEntry) };
}

function manifestStamp(manifest) {
  return sha256(JSON.stringify(manifest));
}

function snapshotPath(argument) {
  if (!argument) throw new Error('Snapshot mode requires a destination outside the repository.');
  const destination = resolve(argument);
  const relation = relative(repositoryRoot, destination);
  const insideRepository = relation === ''
    || (relation !== '..' && !relation.startsWith(`..${sep}`) && !isAbsolute(relation));
  if (insideRepository) throw new Error('Store revision snapshots outside the repository.');
  if (existsSync(destination)) throw new Error(`Snapshot destination already exists: ${destination}`);
  return destination;
}

function writeSnapshot(destination, manifest) {
  mkdirSync(join(destination, 'blobs'), { recursive: true });
  for (const entry of manifest.entries) {
    if (entry.kind !== 'file') continue;
    const blob = join(destination, 'blobs', entry.digest);
    if (!existsSync(blob)) cpSync(join(repositoryRoot, entry.path), blob, { errorOnExist: false });
  }
  writeFileSync(join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
}

function readSnapshot(path) {
  return JSON.parse(readFileSync(join(resolve(path), 'manifest.json'), 'utf8'));
}

function changedEntries(baseline, current, baselinePath) {
  const before = new Map(baseline.entries.map((entry) => [entry.path, entry]));
  const after = new Map(current.entries.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changes = [];
  for (const path of paths) {
    const oldEntry = before.get(path);
    const newEntry = after.get(path);
    if (JSON.stringify(oldEntry) === JSON.stringify(newEntry)) continue;
    changes.push({
      status: !oldEntry ? 'A' : !newEntry ? 'D' : 'M',
      path,
      baselineBlob: oldEntry?.kind === 'file' ? join(resolve(baselinePath), 'blobs', oldEntry.digest) : null,
      currentPath: newEntry ? join(repositoryRoot, path) : null,
    });
  }
  if (baseline.head !== current.head) changes.unshift({ status: 'M', path: '.git/HEAD' });
  if (JSON.stringify(baseline.index) !== JSON.stringify(current.index)) changes.unshift({ status: 'M', path: '.git/index-state' });
  return changes;
}

function compareSnapshot(path, failOnChange) {
  const baseline = readSnapshot(path);
  const current = buildManifest();
  const changes = changedEntries(baseline, current, path);
  const output = {
    baselineStamp: manifestStamp(baseline),
    currentStamp: manifestStamp(current),
    same: changes.length === 0,
    changes,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (failOnChange && changes.length > 0) process.exitCode = 1;
}

const [mode = 'stamp', argument] = process.argv.slice(2);
if (mode === 'stamp') {
  process.stdout.write(`${manifestStamp(buildManifest())}\n`);
} else if (mode === 'snapshot') {
  const destination = snapshotPath(argument);
  const manifest = buildManifest();
  writeSnapshot(destination, manifest);
  process.stdout.write(`${JSON.stringify({ snapshot: destination, stamp: manifestStamp(manifest) })}\n`);
} else if (mode === 'compare') {
  compareSnapshot(argument, false);
} else if (mode === 'verify') {
  compareSnapshot(argument, true);
} else {
  throw new Error('Usage: revision-snapshot.mjs [stamp | snapshot <outside-path> | compare <snapshot> | verify <snapshot>]');
}
