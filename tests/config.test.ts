import { describe, it, expect, afterEach } from 'vitest';
import { defineConfig, clearConfigCache, loadConfig } from '../src/lib/config.ts';

describe('config', () => {
  afterEach(() => {
    clearConfigCache();
  });

  it('defineConfig returns the config unchanged', () => {
    const config = defineConfig({
      baseBranch: 'main',
      excludePatterns: ['*.md'],
    });

    expect(config).toEqual({
      baseBranch: 'main',
      excludePatterns: ['*.md'],
    });
  });

  it('loadConfig returns empty config when no config file exists', async () => {
    const config = await loadConfig('/nonexistent/path');
    expect(config).toEqual({});
  });
});
