// In your project, use: import { defineConfig } from 'ai-cmds';
import { defineConfig } from './src/lib/config.ts';

export default defineConfig({
  reviewCodeChanges: {
    // Default base branch for diff comparison
    // Can be a static string or a function that receives the current branch name
    baseBranch: 'main',
    // baseBranch: (currentBranch) => currentBranch.startsWith('release/') ? 'main' : 'develop',

    // Files to exclude from code review diff (glob patterns)
    codeReviewDiffExcludePatterns: ['pnpm-lock.yaml', '**/*.svg', '**/*.test.ts'],

    // Path to custom review instructions (optional)
    // reviewInstructionsPath: '.github/PR_REVIEW_AGENT.md',

    // Custom named setups (selectable via --setup flag)
    // setup: [
    //   {
    //     label: 'myCustomSetup',
    //     reviewers: [
    //       { label: 'GPT-5', model: openai('gpt-5.2'), providerOptions: { reasoningEffort: 'high' } },
    //     ],
    //     validator: { model: openai('gpt-5.2') },
    //     formatter: { model: openai('gpt-5-mini') },
    //   },
    // ],

    // Default validator/formatter for custom setups that don't specify them
    // defaultValidator: { model: openai('gpt-5.2'), providerOptions: { reasoningEffort: 'high' } },
    // defaultFormatter: { model: openai('gpt-5-mini') },

    // Directory for logs (optional, can also use AI_CLI_LOGS_DIR env var)
    // logsDir: './pr-review-logs',
  },
});
