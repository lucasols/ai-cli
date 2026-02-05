// In your project, use: import { defineConfig } from 'ai-cmds';
import { defineConfig } from './src/lib/config.ts';

export default defineConfig({
  // Default base branch for diff comparison
  baseBranch: 'main',

  // Files to exclude from review (glob patterns)
  excludePatterns: ['pnpm-lock.yaml', '**/*.svg', '**/*.test.ts'],

  // Path to custom review instructions (optional)
  // reviewInstructionsPath: '.github/PR_REVIEW_AGENT.md',

  // Default review setup (optional)
  // defaultSetup: 'light',

  // Directory for logs (optional, requires PR_REVIEW_LOGS env to be set)
  // logsDir: './pr-review-logs',
});
