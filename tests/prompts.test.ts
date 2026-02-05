import { describe, expect, it } from 'vitest';
import {
  createReviewPrompt,
  createValidationPrompt,
} from '../src/commands/shared/prompts.ts';
import { createZeroTokenUsage } from '../src/commands/shared/output.ts';

describe('review prompt instruction options', () => {
  const context = { type: 'local' as const };
  const changedFiles = ['src/example.ts'];
  const prDiff = 'diff --git a/src/example.ts b/src/example.ts';

  it('appends custom instruction while keeping default instructions', () => {
    const prompt = createReviewPrompt(context, null, changedFiles, prDiff, {
      includeAgentsFileInReviewPrompt: false,
      customReviewInstruction: 'Focus on authorization and access checks.',
    });

    expect(prompt.system).toContain('# Code Review Instructions');
    expect(prompt.system).toContain('Trust the tooling');
    expect(prompt.system).toContain('## Additional Focus');
    expect(prompt.system).toContain('Focus on authorization and access checks.');
  });

  it('can skip default instructions', () => {
    const prompt = createReviewPrompt(context, null, changedFiles, prDiff, {
      includeAgentsFileInReviewPrompt: false,
      includeDefaultReviewInstructions: false,
      customReviewInstruction: 'Prioritize data integrity issues.',
    });

    expect(prompt.system).not.toContain('Trust the tooling');
    expect(prompt.system).toContain('Prioritize data integrity issues.');
  });

  it('uses fallback instructions when defaults are disabled and no custom instruction is provided', () => {
    const prompt = createReviewPrompt(context, null, changedFiles, prDiff, {
      includeAgentsFileInReviewPrompt: false,
      includeDefaultReviewInstructions: false,
    });

    expect(prompt.system).toContain('Focus on concrete, actionable issues');
  });

  it('applies instruction options to validation prompts', () => {
    const prompt = createValidationPrompt(
      context,
      [
        {
          reviewerId: 1,
          content: 'No issues identified in this review.',
          usage: createZeroTokenUsage('gpt-5.2'),
        },
      ],
      null,
      changedFiles,
      prDiff,
      undefined,
      {
        includeDefaultReviewInstructions: false,
        customReviewInstruction: 'Focus only on concurrency and race conditions.',
      },
    );

    expect(prompt.system).not.toContain('Trust the tooling');
    expect(prompt.system).toContain(
      'Focus only on concurrency and race conditions.',
    );
  });
});
