import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseSandboxContract } from '../../autoresearch/contracts.js';
import { initAutoresearchMission, parseInitArgs, checkTmuxAvailable } from '../autoresearch-guided.js';

async function initRepo(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'omc-autoresearch-guided-test-'));
  execFileSync('git', ['init'], { cwd, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd, stdio: 'ignore' });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(cwd, 'README.md'), 'hello\n', 'utf-8');
  execFileSync('git', ['add', 'README.md'], { cwd, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd, stdio: 'ignore' });
  return cwd;
}

describe('initAutoresearchMission', () => {
  it('creates mission.md with correct content', async () => {
    const repo = await initRepo();
    try {
      const result = await initAutoresearchMission({
        topic: 'Improve test coverage for the auth module',
        evaluatorCommand: 'node scripts/eval.js',
        keepPolicy: 'score_improvement',
        slug: 'auth-coverage',
        repoRoot: repo,
      });

      expect(result.slug).toBe('auth-coverage');
      expect(result.missionDir).toBe(join(repo, 'missions', 'auth-coverage'));

      const missionContent = await readFile(join(result.missionDir, 'mission.md'), 'utf-8');
      expect(missionContent).toMatch(/# Mission/);
      expect(missionContent).toMatch(/Improve test coverage for the auth module/);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it('creates sandbox.md with valid YAML frontmatter', async () => {
    const repo = await initRepo();
    try {
      const result = await initAutoresearchMission({
        topic: 'Optimize database queries',
        evaluatorCommand: 'node scripts/eval-perf.js',
        keepPolicy: 'pass_only',
        slug: 'db-perf',
        repoRoot: repo,
      });

      const sandboxContent = await readFile(join(result.missionDir, 'sandbox.md'), 'utf-8');
      expect(sandboxContent).toMatch(/^---\n/);
      expect(sandboxContent).toMatch(/evaluator:/);
      expect(sandboxContent).toMatch(/command: node scripts\/eval-perf\.js/);
      expect(sandboxContent).toMatch(/format: json/);
      expect(sandboxContent).toMatch(/keep_policy: pass_only/);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it('generated sandbox.md passes parseSandboxContract validation', async () => {
    const repo = await initRepo();
    try {
      const result = await initAutoresearchMission({
        topic: 'Fix flaky tests',
        evaluatorCommand: 'bash run-tests.sh',
        keepPolicy: 'score_improvement',
        slug: 'flaky-tests',
        repoRoot: repo,
      });

      const sandboxContent = await readFile(join(result.missionDir, 'sandbox.md'), 'utf-8');
      const parsed = parseSandboxContract(sandboxContent);
      expect(parsed.evaluator.command).toBe('bash run-tests.sh');
      expect(parsed.evaluator.format).toBe('json');
      expect(parsed.evaluator.keep_policy).toBe('score_improvement');
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it('throws if mission directory already exists', async () => {
    const repo = await initRepo();
    try {
      const missionDir = join(repo, 'missions', 'existing');
      await mkdir(missionDir, { recursive: true });

      await expect(
        initAutoresearchMission({
          topic: 'duplicate',
          evaluatorCommand: 'echo ok',
          keepPolicy: 'pass_only',
          slug: 'existing',
          repoRoot: repo,
        }),
      ).rejects.toThrow(/already exists/);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});

describe('parseInitArgs', () => {
  it('parses all flags with space-separated values', () => {
    const result = parseInitArgs([
      '--topic', 'my topic',
      '--evaluator', 'node eval.js',
      '--keep-policy', 'pass_only',
      '--slug', 'my-slug',
    ]);
    expect(result.topic).toBe('my topic');
    expect(result.evaluatorCommand).toBe('node eval.js');
    expect(result.keepPolicy).toBe('pass_only');
    expect(result.slug).toBe('my-slug');
  });

  it('parses all flags with = syntax', () => {
    const result = parseInitArgs([
      '--topic=my topic',
      '--evaluator=node eval.js',
      '--keep-policy=score_improvement',
      '--slug=my-slug',
    ]);
    expect(result.topic).toBe('my topic');
    expect(result.evaluatorCommand).toBe('node eval.js');
    expect(result.keepPolicy).toBe('score_improvement');
    expect(result.slug).toBe('my-slug');
  });

  it('returns partial result when some flags are missing', () => {
    const result = parseInitArgs(['--topic', 'my topic']);
    expect(result.topic).toBe('my topic');
    expect(result.evaluatorCommand).toBeUndefined();
    expect(result.keepPolicy).toBeUndefined();
    expect(result.slug).toBeUndefined();
  });

  it('throws on invalid keep-policy', () => {
    expect(() => parseInitArgs(['--keep-policy', 'invalid'])).toThrow(/must be one of/);
  });

  it('throws on unknown flags', () => {
    expect(() => parseInitArgs(['--unknown-flag', 'value'])).toThrow(/Unknown init flag: --unknown-flag/);
  });

  it('sanitizes slug via slugifyMissionName', () => {
    const result = parseInitArgs(['--slug', '../../etc/cron.d/omc']);
    expect(result.slug).toBeTruthy();
    expect(result.slug!).not.toMatch(/\.\./);
    expect(result.slug!).not.toMatch(/\//);
  });
});

describe('checkTmuxAvailable', () => {
  it('returns a boolean', () => {
    const result = checkTmuxAvailable();
    expect(typeof result).toBe('boolean');
  });
});
