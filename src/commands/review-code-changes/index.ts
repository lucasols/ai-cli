import { cliInput, createCmd } from '@ls-stack/cli';
import { dedent } from '@ls-stack/utils/dedent';
import { writeFile } from 'fs/promises';
import { estimateTokenCount } from 'tokenx';
import {
  getExcludePatterns,
  loadConfig,
  resolveBaseBranch,
  type ScopeConfig,
  type ScopeContext,
} from '../../lib/config.ts';
import { formatNum } from '../../lib/diff.ts';
import { git } from '../../lib/git.ts';
import { runCmdSilentUnwrap, showErrorAndExit } from '../../lib/shell.ts';
import {
  calculateReviewsUsage,
  calculateTotalUsage,
  formatValidatedReview,
  handleOutput,
  logTokenUsageBreakdown,
} from '../shared/output.ts';
import { reviewValidator, runSingleReview } from '../shared/reviewer.ts';
import {
  getAvailableScopes,
  resolveScope,
  tryGetFileCountSync,
} from '../shared/scopes.ts';
import {
  getAvailableSetups,
  resolveSetup,
  type ReviewSetupConfig,
} from '../shared/setups.ts';
import { getDiffForFiles, applyExcludePatterns } from '../shared/diff-utils.ts';
import type { IndividualReview, LocalReviewContext } from '../shared/types.ts';

const MAX_DIFF_TOKENS = 60_000;

async function fetchLocalFileLists(baseBranch: string): Promise<ScopeContext> {
  const stagedFilesPromise = runCmdSilentUnwrap([
    'git',
    'diff',
    '--cached',
    '--name-only',
  ]).then((output) => output.trim().split('\n').filter(Boolean));

  const allFilesPromise = (async () => {
    await runCmdSilentUnwrap([
      'git',
      'fetch',
      'origin',
      `${baseBranch}:${baseBranch}`,
    ]).catch(() => {
      // Ignore errors if branch doesn't exist on remote or is already up to date
    });

    const output = await runCmdSilentUnwrap([
      'git',
      'diff',
      '--name-only',
      `origin/${baseBranch}...HEAD`,
    ]);
    return output.trim().split('\n').filter(Boolean);
  })();

  const [stagedFiles, allFiles] = await Promise.all([
    stagedFilesPromise,
    allFilesPromise,
  ]);

  return { stagedFiles, allFiles };
}

export const reviewCodeChangesCommand = createCmd({
  description: 'Review local code changes with AI',
  short: 'rc',
  args: {
    setup: {
      type: 'value-string-flag',
      name: 'setup',
      description: 'Review setup (light, medium, heavy)',
    },
    scope: {
      type: 'value-string-flag',
      name: 'scope',
      description: 'Review scope (all, staged)',
    },
    baseBranch: {
      type: 'value-string-flag',
      name: 'base-branch',
      description: 'Base branch for diff comparison',
    },
  },
  examples: [
    { args: ['--scope', 'staged'], description: 'Review staged changes' },
    { args: ['--scope', 'all'], description: 'Review all changes vs base' },
    { args: ['--setup', 'light'], description: 'Use light review setup' },
  ],
  run: async ({ setup, scope, baseBranch }) => {
    const rootConfig = await loadConfig();
    const config = rootConfig.reviewCodeChanges ?? {};

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
      const builtInOptions = [
        { value: 'light', label: 'Light - 1 GPT-5 reviewer' },
        { value: 'medium', label: 'Medium - 2 GPT-5 reviewers' },
        { value: 'heavy', label: 'Heavy - 4 GPT-5 reviewers' },
      ];

      const customOptions =
        config.setup?.map((s) => ({
          value: s.label,
          label: s.label,
        })) ?? [];

      const options = customOptions.length > 0 ? customOptions : builtInOptions;

      const selectedSetup = await cliInput.select('Select the review setup', {
        options,
      });

      setupLabel = selectedSetup;
      setupConfig = resolveSetup(config, selectedSetup);

      if (!setupConfig) {
        showErrorAndExit(`Failed to resolve setup: ${selectedSetup}`);
      }
    }

    const currentBranch = git.getCurrentBranch();

    const resolvedBaseBranch =
      baseBranch ?? resolveBaseBranch(config.baseBranch, currentBranch, 'main');

    console.log('\n🔄 Fetching file lists...');
    const scopeContext = await fetchLocalFileLists(resolvedBaseBranch);

    let scopeConfig: ScopeConfig | undefined = resolveScope(config, scope);
    let scopeLabel = scope;

    if (scope && !scopeConfig) {
      const availableScopes = getAvailableScopes(config);
      showErrorAndExit(
        `Invalid scope: ${scope}. Valid options: ${availableScopes.join(', ')}`,
      );
    }

    if (!scopeConfig) {
      const builtInOptions = [
        {
          value: 'all',
          label: `All changes (${scopeContext.allFiles.length} files)`,
        },
        {
          value: 'staged',
          label: `Staged changes (${scopeContext.stagedFiles.length} files)`,
        },
      ];

      const customOptions =
        config.scope?.map((s) => {
          const fileCount = tryGetFileCountSync(s, scopeContext);
          return {
            value: s.label,
            label:
              fileCount !== null ? `${s.label} (${fileCount} files)` : s.label,
          };
        }) ?? [];

      const options = customOptions.length > 0 ? customOptions : builtInOptions;

      const selectedScope = await cliInput.select('Select the review scope', {
        options,
      });

      scopeLabel = selectedScope;
      scopeConfig = resolveScope(config, selectedScope);

      if (!scopeConfig) {
        showErrorAndExit(`Failed to resolve scope: ${selectedScope}`);
      }
    }

    const scopeFiles = await scopeConfig.getFiles(scopeContext);
    const excludePatterns = getExcludePatterns(config);
    const changedFiles = applyExcludePatterns(scopeFiles, excludePatterns);

    if (changedFiles.length === 0) {
      showErrorAndExit(
        `No files found for scope "${scopeLabel}"${excludePatterns ? ' after applying exclude patterns' : ''}`,
      );
    }

    if (excludePatterns && scopeFiles.length !== changedFiles.length) {
      const excludedCount = scopeFiles.length - changedFiles.length;
      console.log(
        `📂 Reviewing ${changedFiles.length} files (${excludedCount} files filtered out)`,
      );
    }

    const sourceDescription =
      scopeLabel === 'staged' ? 'staged changes' : (
        `${currentBranch} vs ${resolvedBaseBranch}`
      );

    console.log(`\n🔄 Processing ${sourceDescription}...`);

    console.log(
      `📋 Using ${setupLabel} setup with ${setupConfig.reviewers.length} reviewer(s)\n`,
    );

    const useStaged = scopeLabel === 'staged';
    const prDiff = await getDiffForFiles(changedFiles, {
      baseBranch: resolvedBaseBranch,
      excludeFiles: excludePatterns,
      useStaged,
    });

    const diffTokens = estimateTokenCount(prDiff);

    if (diffTokens > MAX_DIFF_TOKENS) {
      console.warn(
        `⚠️ Warning: Diff has ${formatNum(diffTokens)} tokens (max recommended: ${formatNum(MAX_DIFF_TOKENS)})`,
      );
    }

    const context: LocalReviewContext = {
      type: 'local',
      additionalInstructions: undefined,
    };

    console.log(
      `🔍 Running ${setupConfig.reviewers.length} independent reviews...`,
    );

    const reviewPromises = setupConfig.reviewers.map((model, index) =>
      runSingleReview(
        context,
        null,
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

    console.log('🔍 Running feedback checker to validate findings...');
    const validatedReview = await reviewValidator(
      context,
      successfulReviews,
      null,
      changedFiles,
      prDiff,
      undefined,
      setupConfig.validator,
      setupConfig.formatter,
      config.reviewInstructionsPath,
    );
    console.log(
      `✅ Validation complete - found ${validatedReview.issues.length} validated issues`,
    );

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

    console.log('📝 Formatting review...');
    const reviewContent = await formatValidatedReview(
      validatedReview,
      'local',
      context,
      currentBranch,
      {
        reviews: successfulReviews,
        validatorUsage: validatedReview.usage,
        formatterUsage: validatedReview.formatterUsage,
      },
    );

    const outputFile = 'pr-review.md';
    await writeFile(outputFile, reviewContent);

    await handleOutput(context, reviewContent);
  },
});
