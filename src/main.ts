import { createCLI, createCmd } from './createCli.ts';

await createCLI(
  { name: '✨ ai-cli', baseCmd: 'ai-cli' },
  {
    'review-pr': createCmd({
      description: 'Review a pull request with AI',
      short: 'rpr',
      run: async () => {
        console.log('Reviewing pull request');
      },
    }),
  },
);
