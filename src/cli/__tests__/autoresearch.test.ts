import { describe, it, expect } from 'vitest';
import { normalizeAutoresearchClaudeArgs, parseAutoresearchArgs } from '../autoresearch.js';

describe('normalizeAutoresearchClaudeArgs', () => {
  it('adds permission bypass by default for autoresearch workers', () => {
    expect(normalizeAutoresearchClaudeArgs(['--model', 'opus'])).toEqual(['--model', 'opus', '--dangerously-skip-permissions']);
  });

  it('deduplicates explicit bypass flags', () => {
    expect(normalizeAutoresearchClaudeArgs(['--dangerously-skip-permissions'])).toEqual(['--dangerously-skip-permissions']);
  });
});

describe('parseAutoresearchArgs', () => {
  it('parses mission-dir as first positional argument', () => {
    const parsed = parseAutoresearchArgs(['/path/to/mission']);
    expect(parsed.missionDir).toBe('/path/to/mission');
    expect(parsed.runId).toBeNull();
    expect(parsed.claudeArgs).toEqual([]);
  });

  it('parses --resume with run-id', () => {
    const parsed = parseAutoresearchArgs(['--resume', 'my-run-id']);
    expect(parsed.missionDir).toBeNull();
    expect(parsed.runId).toBe('my-run-id');
  });

  it('parses --resume= with run-id', () => {
    const parsed = parseAutoresearchArgs(['--resume=my-run-id']);
    expect(parsed.missionDir).toBeNull();
    expect(parsed.runId).toBe('my-run-id');
  });

  it('parses --help', () => {
    const parsed = parseAutoresearchArgs(['--help']);
    expect(parsed.missionDir).toBe('--help');
  });

  it('parses init subcommand', () => {
    const parsed = parseAutoresearchArgs(['init', '--topic', 'my topic']);
    expect(parsed.guided).toBe(true);
    expect(parsed.initArgs).toEqual(['--topic', 'my topic']);
  });

  it('passes extra args as claudeArgs', () => {
    const parsed = parseAutoresearchArgs(['/path/to/mission', '--model', 'opus']);
    expect(parsed.missionDir).toBe('/path/to/mission');
    expect(parsed.claudeArgs).toEqual(['--model', 'opus']);
  });

  it('rejects flags before mission-dir', () => {
    expect(() => parseAutoresearchArgs(['--unknown-flag'])).toThrow(/mission-dir must be the first positional argument/);
  });
});
