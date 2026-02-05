import { createCLI } from '@ls-stack/cli';
import { reviewCodeChangesCommand } from './commands/review-code-changes/index.ts';

await createCLI(
  { name: '✨ ai-cmds', baseCmd: 'ai-cmds' },
  {
    'review-code-changes': reviewCodeChangesCommand,
  },
);
