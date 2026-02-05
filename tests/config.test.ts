import { describe, it, expect, afterEach } from 'vitest';
import { defineConfig, clearConfigCache, loadConfig } from '../src/lib/config.ts';

describe('config', () => {
  afterEach(() => {
    clearConfigCache();
  });

  it('defineConfig returns the config unchanged', () => {
    const config = defineConfig({
      reviewCodeChanges: {
        baseBranch: 'main',
        codeReviewDiffExcludePatterns: ['*.md'],
      },
    });

    expect(config).toEqual({
      reviewCodeChanges: {
        baseBranch: 'main',
        codeReviewDiffExcludePatterns: ['*.md'],
      },
    });
  });

  it('loadConfig returns empty config when no config file exists', async () => {
    const config = await loadConfig('/nonexistent/path');
    expect(config).toEqual({});
  });
});
