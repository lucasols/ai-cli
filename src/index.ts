export {
  defineConfig,
  type Config,
  type CustomModelConfig,
  type ReviewCodeChangesConfig,
  type ScopeConfig,
  type ScopeContext,
  type SetupConfig,
} from './lib/config.ts';

export { BUILT_IN_SETUP_OPTIONS } from './commands/review-code-changes/setups.ts';
export {
  BUILT_IN_SCOPE_OPTIONS,
  DEFAULT_SCOPES,
} from './commands/review-code-changes/scopes.ts';
