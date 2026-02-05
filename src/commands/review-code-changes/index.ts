import { cliInput, createCmd } from '@ls-stack/cli';
import { dedent } from '@ls-stack/utils/dedent';
import { writeFile } from 'fs/promises';
import path from 'path';
import { estimateTokenCount } from 'tokenx';
import {
  getExcludePatterns,
  loadConfig,
  resolveBaseBranch,
} from '../../lib/config.ts';
import { git } from '../../lib/git.ts';
import { github, type PRData } from '../../lib/github.ts';
import { runCmdSilentUnwrap, showErrorAndExit } from '../../lib/shell.ts';
import {
  calculateReviewsUsage,
  calculateTotalUsage,
  formatValidatedReview,
  handleOutput,
  logTokenUsageBreakdown,
} from './output.ts';
import { reviewValidator, runSingleReview } from './reviewer.ts';
import {
  getAvailableSetups,
  resolveSetup,
  type ReviewSetupConfig,
} from './setups.ts';
import type {
  IndividualReview,
  PRReviewContext,
  ReviewScope,
} from './types.ts';

const MAX_DIFF_TOKENS = 60_000;

function formatNum(num: number): string {
  return num.toLocaleString('en-US');
}

function removeImportOnlyChangesFromDiff(diff: string): string {
  const fileSections = diff.split(/(?=^diff --git)/m).filter(Boolean);
  const filteredSections: string[] = [];

  for (const section of fileSections) {
    if (!section.startsWith('diff --git')) continue;

    const lines = section.split('\n');
    const changedLines = lines.filter(
      (line) =>
        (line.startsWith('+') || line.startsWith('-')) &&
        !line.startsWith('+++') &&
        !line.startsWith('---'),
    );

    if (changedLines.length === 0) {
      filteredSections.push(section);
      continue;
    }

    const hasNonImportChanges = changedLines.some((line) => {
      const cleanLine = line.slice(1).trim();

      if (!cleanLine) return false;

      const isImportOrExport =
        cleanLine.startsWith('import ') ||
        cleanLine.startsWith('export ') ||
        cleanLine.startsWith('} from ') ||
        cleanLine.includes('= require(') ||
        cleanLine.includes('import(') ||
        /^import\s*{/.test(cleanLine) ||
        /^export\s*{/.test(cleanLine) ||
        (cleanLine.startsWith('type ') && cleanLine.includes('import('));

      return !isImportOrExport;
    });

    if (hasNonImportChanges) {
      filteredSections.push(section);
    }
  }

  return filteredSections.join('\n');
}

async function fetchPRData(
  prNumber: string | null,
  options: {
    filterFiles?: string[];
    excludeFiles?: string[];
    baseBranch?: string;
    staged?: boolean;
  } = {},
): Promise<{
  prData: PRData | null;
  changedFiles: string[];
  prDiff: string;
  baseBranch: string;
}> {
  const {
    filterFiles,
    excludeFiles,
    baseBranch: baseBranchOverride,
    staged,
  } = options;

  let prData: PRData | null;
  let allChangedFiles: string[];
  let baseBranch: string;

  if (staged) {
    baseBranch = baseBranchOverride ?? 'main';
    prData = null;

    const stagedFilesOutput = await runCmdSilentUnwrap([
      'git',
      'diff',
      '--cached',
      '--name-only',
    ]);
    allChangedFiles = stagedFilesOutput.trim().split('\n').filter(Boolean);

    if (allChangedFiles.length === 0) {
      throw new Error('No staged changes found');
    }
  } else if (prNumber) {
    [prData, allChangedFiles] = await Promise.all([
      github.getPRData(prNumber),
      github.getChangedFiles(prNumber),
    ]);
    baseBranch = prData.baseRefName;
  } else {
    baseBranch = baseBranchOverride ?? 'main';
    prData = null;

    const changedFilesOutput = await runCmdSilentUnwrap([
      'git',
      'diff',
      '--name-only',
      `origin/${baseBranch}...HEAD`,
    ]);
    allChangedFiles = changedFilesOutput.trim().split('\n').filter(Boolean);
  }

  let changedFiles = allChangedFiles;

  if (filterFiles) {
    changedFiles = changedFiles.filter((file) =>
      filterFiles.some((pattern) => path.matchesGlob(file, pattern)),
    );
  }

  if (excludeFiles) {
    changedFiles = changedFiles.filter(
      (file) =>
        !excludeFiles.some((pattern) => path.matchesGlob(file, pattern)),
    );
  }

  if ((filterFiles || excludeFiles) && changedFiles.length === 0) {
    throw new Error('No files match the filter criteria');
  }

  if (filterFiles || excludeFiles) {
    const excludedCount = allChangedFiles.length - changedFiles.length;
    console.log(
      `📂 Reviewing ${changedFiles.length} files (${excludedCount} files filtered out)`,
    );
  }

  let prDiff: string;

  if (staged) {
    const rawDiff = await git.getStagedDiff({
      includeFiles: filterFiles,
      ignoreFiles: excludeFiles,
      silent: true,
    });

    prDiff = removeImportOnlyChangesFromDiff(rawDiff);

    console.log(
      `📝 Staged diff: ${Math.round(prDiff.length / 1024)}KB, ${prDiff.split('\n').length} lines, ${formatNum(estimateTokenCount(prDiff))} tokens`,
    );
  } else {
    await runCmdSilentUnwrap([
      'git',
      'fetch',
      'origin',
      `${baseBranch}:${baseBranch}`,
    ]).catch(() => {
      // Ignore errors if branch doesn't exist on remote or is already up to date
    });

    const rawDiff = await git.getDiffToBranch(baseBranch, {
      includeFiles: filterFiles,
      ignoreFiles: excludeFiles,
      silent: true,
    });

    prDiff = removeImportOnlyChangesFromDiff(rawDiff);

    console.log(
      `📝 Diff: ${Math.round(prDiff.length / 1024)}KB, ${prDiff.split('\n').length} lines, ${formatNum(estimateTokenCount(prDiff))} tokens`,
    );
  }

  return { prData, changedFiles, prDiff, baseBranch };
}

export const reviewCodeChangesCommand = createCmd({
  description: 'Review code with AI',
  short: 'rc',
  args: {
    setup: {
      type: 'value-string-flag',
      name: 'setup',
      description:
        'Review setup (veryLight, lightGoogle, mediumGoogle, light, medium, heavy)',
    },
    scope: {
      type: 'value-string-flag',
      name: 'scope',
      description: 'Review scope (all, staged, pr)',
    },
    pr: {
      type: 'value-string-flag',
      name: 'pr',
      description: 'PR number to review',
    },
    baseBranch: {
      type: 'value-string-flag',
      name: 'base-branch',
      description: 'Base branch for diff comparison',
    },
  },
  examples: [
    { args: ['--scope', 'staged'], description: 'Review staged changes' },
    { args: ['--pr', '123'], description: 'Review PR #123' },
    { args: ['--setup', 'light'], description: 'Use light review setup' },
  ],
  run: async ({ setup, scope, pr, baseBranch }) => {
    const rootConfig = await loadConfig();
    const config = rootConfig.reviewCodeChanges ?? {};

    // Resolve setup from CLI arg or interactive selection
    let setupConfig: ReviewSetupConfig | undefined = resolveSetup(
      config,
      setup,
    );
    let setupLabel = setup;

    if (setup && !setupConfig) {
      const availableSetups = getAvailableSetups(config);
      showErrorAndExit(
        `Invalid setup: ${setup}. Valid options: ${availableSetups.join(', ')}`,
      );
    }

    if (!setupConfig) {
      // Interactive selection - show built-in options plus any custom setups
      const builtInOptions = [
        {
          value: 'veryLight',
          label: 'Very light - 1 GPT-5-mini reviewer',
        },
        { value: 'light', label: 'Light - 1 GPT-5 reviewer' },
        { value: 'medium', label: 'Medium - 2 GPT-5 reviewers' },
        { value: 'heavy', label: 'Heavy - 4 GPT-5 reviewers' },
      ];

      const customOptions =
        config.setup?.map((s) => ({
          value: s.label,
          label: `${s.label} (custom) - ${s.reviewers.length} reviewer(s)`,
        })) ?? [];

      const selectedSetup = await cliInput.select(
        'Select the review setup (be careful, the heavier the setup, more costly it will be!)',
        {
          options: [...builtInOptions, ...customOptions],
        },
      );

      setupLabel = selectedSetup;
      setupConfig = resolveSetup(config, selectedSetup);

      if (!setupConfig) {
        showErrorAndExit(`Failed to resolve setup: ${selectedSetup}`);
      }
    }

    // Select review scope
    let reviewScope: ReviewScope;
    let prNumber: string | null = pr ?? null;

    if (scope) {
      if (!['all', 'staged', 'pr'].includes(scope)) {
        showErrorAndExit(
          `Invalid scope: ${scope}. Valid options: all, staged, pr`,
        );
      }
      reviewScope = scope as ReviewScope;
    } else {
      reviewScope = await cliInput.select('Select the review scope', {
        options: [
          {
            value: 'all' as const,
            label: 'All changes (compared to base branch)',
          },
          { value: 'staged' as const, label: 'Staged changes only' },
          { value: 'pr' as const, label: 'PR (enter PR number)' },
        ],
      });
    }

    if (reviewScope === 'pr' && !prNumber) {
      const prInput = await cliInput.text('Enter PR number');
      prNumber = prInput;
    }

    const currentBranch = git.getCurrentBranch();

    // Resolve base branch (supports function form)
    const resolvedBaseBranch =
      baseBranch ?? resolveBaseBranch(config.baseBranch, currentBranch, 'main');
    const sourceDescription =
      reviewScope === 'staged' ? 'staged changes'
      : prNumber ? `PR #${prNumber}`
      : `${currentBranch} vs ${resolvedBaseBranch}`;

    console.log(`\n🔄 Processing ${sourceDescription}...`);

    console.log(
      `📋 Using ${setupLabel} setup with ${setupConfig.reviewers.length} reviewer(s)\n`,
    );

    // Fetch PR data
    const { prData, changedFiles, prDiff } = await fetchPRData(prNumber, {
      excludeFiles: getExcludePatterns(config),
      baseBranch: resolvedBaseBranch,
      staged: reviewScope === 'staged',
    });

    const diffTokens = estimateTokenCount(prDiff);

    if (diffTokens > MAX_DIFF_TOKENS) {
      console.warn(
        `⚠️ Warning: PR has ${formatNum(diffTokens)} tokens in the diff (max recommended: ${formatNum(MAX_DIFF_TOKENS)})`,
      );
    }

    // Create context
    const context: PRReviewContext = {
      mode: 'local',
      isTestGhMode: false,
      prNumber,
      additionalInstructions: undefined,
    };

    // Run reviews
    console.log(
      `🔍 Running ${setupConfig.reviewers.length} independent reviews...`,
    );

    const reviewPromises = setupConfig.reviewers.map((model, index) =>
      runSingleReview(
        context,
        prData,
        changedFiles,
        prDiff,
        index + 1,
        model,
        config.reviewInstructionsPath,
      ),
    );

    const successfulReviews: IndividualReview[] = [];

    const results = await Promise.allSettled(reviewPromises);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        successfulReviews.push(result.value);
      } else {
        console.error('Review failed:', result.reason);
      }
    }

    if (successfulReviews.length === 0) {
      showErrorAndExit('All reviewers failed - cannot proceed with review');
    }

    console.log('\n');

    // Fetch human comments if reviewing a PR
    let humanComments;
    if (prNumber) {
      console.log('📥 Fetching human review comments...');
      try {
        humanComments = await github.getAllHumanPRComments(prNumber);
        console.log(
          `📋 Found ${humanComments.length} general comments from humans`,
        );
      } catch (error) {
        console.warn('⚠️ Failed to fetch human comments:', error);
      }
    }

    // Run validation
    console.log('🔍 Running feedback checker to validate findings...');
    const validatedReview = await reviewValidator(
      context,
      successfulReviews,
      prData,
      changedFiles,
      prDiff,
      humanComments,
      setupConfig.validator,
      setupConfig.formatter,
      config.reviewInstructionsPath,
    );
    console.log(
      `✅ Validation complete - found ${validatedReview.issues.length} validated issues`,
    );

    // Log usage
    const reviewsUsage = calculateReviewsUsage(successfulReviews);
    const totalUsage = calculateTotalUsage([
      ...successfulReviews.map((review) => review.usage),
      validatedReview.usage,
      validatedReview.formatterUsage,
    ]);

    logTokenUsageBreakdown(
      reviewsUsage,
      validatedReview.usage,
      validatedReview.formatterUsage,
    );

    console.log(
      dedent`
        📊 Tokens:
          Total: ${formatNum(totalUsage.totalTokens || 0)}
          Input: ${formatNum(totalUsage.promptTokens || 0)}
          Output: ${formatNum(totalUsage.completionTokens || 0)}
          Reasoning: ${formatNum(totalUsage.reasoningTokens || 0)}
      `,
    );

    // Format and output review
    console.log('📝 Formatting review...');
    const authorLogin = prData?.author.login ?? 'local';
    const headRefName = prData?.headRefName ?? currentBranch;
    const reviewContent = await formatValidatedReview(
      validatedReview,
      authorLogin,
      context,
      headRefName,
      {
        reviews: successfulReviews,
        validatorUsage: validatedReview.usage,
        formatterUsage: validatedReview.formatterUsage,
      },
    );

    // Write to file
    const outputFile = 'pr-review.md';
    await writeFile(outputFile, reviewContent);

    // Handle output
    await handleOutput(context, reviewContent);
  },
});
