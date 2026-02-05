export {
  defineConfig,
  type Config,
  type CustomModelConfig,
  type ReviewCodeChangesConfig,
  type ScopeConfig,
  type ScopeContext,
  type SetupConfig,
} from './lib/config.ts';

export { BUILT_IN_SETUP_OPTIONS } from './commands/shared/setups.ts';
export {
  BUILT_IN_SCOPE_OPTIONS,
  DEFAULT_SCOPES,
} from './commands/shared/scopes.ts';
