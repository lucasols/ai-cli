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
    // When custom setups are configured, they REPLACE built-in options.
    // To include built-in options alongside custom ones, use BUILT_IN_SETUP_OPTIONS:
    // setup: [
    //   ...BUILT_IN_SETUP_OPTIONS, // spread built-in options if you want to keep them
    //   {
    //     label: 'myCustomSetup',
    //     reviewers: [
    //       { label: 'GPT-5', model: openai('gpt-5.2'), providerOptions: { reasoningEffort: 'high' } },
    //     ],
    //     validator: { model: openai('gpt-5.2') },
    //     formatter: { model: openai('gpt-5-mini') },
    //   },
    // ],

    // Custom named scopes (selectable via --scope flag)
    // When custom scopes are configured, they REPLACE built-in options (all, staged, pr).
    // To include built-in options alongside custom ones, use BUILT_IN_SCOPE_OPTIONS:
    // scope: [
    //   ...BUILT_IN_SCOPE_OPTIONS, // spread built-in options if you want to keep them
    //   {
    //     label: 'src-only',
    //     getFiles: (ctx) => ctx.allFiles.filter((f) => f.startsWith('src/')),
    //   },
    //   {
    //     label: 'no-tests',
    //     getFiles: (ctx) => ctx.allFiles.filter((f) => !f.includes('.test.')),
    //   },
    // ],

    // Default validator/formatter for custom setups that don't specify them
    // defaultValidator: { model: openai('gpt-5.2'), providerOptions: { reasoningEffort: 'high' } },
    // defaultFormatter: { model: openai('gpt-5-mini') },

    // Directory for logs (optional, can also use AI_CLI_LOGS_DIR env var)
    // logsDir: './pr-review-logs',
  },
});
