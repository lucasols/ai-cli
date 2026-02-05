import type {
  ReviewCodeChangesConfig,
  ScopeConfig,
  ScopeContext,
} from '../../lib/config.ts';

export const DEFAULT_SCOPES = {
  all: {
    id: 'all',
    label: 'All changes',
    showFileCount: true,
    getFiles: (ctx: ScopeContext) => ctx.allFiles,
  },
  staged: {
    id: 'staged',
    label: 'Staged changes',
    showFileCount: true,
    getFiles: (ctx: ScopeContext) => ctx.stagedFiles,
  },
} as const satisfies Record<string, ScopeConfig>;

/**
 * Built-in scope options that users can include in their config.
 * When custom scopes are configured, they replace built-in options.
 * Use this export to include built-in options alongside custom ones:
 *
 * @example
 * ```typescript
 * import { defineConfig, BUILT_IN_SCOPE_OPTIONS } from 'ai-cmds';
 *
 * export default defineConfig({
 *   reviewCodeChanges: {
 *     scope: [
 *       ...BUILT_IN_SCOPE_OPTIONS,
 *       { id: 'custom', label: 'My Custom Scope', getFiles: (ctx) => ctx.allFiles.filter(...) },
 *     ],
 *   },
 * });
 * ```
 */
export const BUILT_IN_SCOPE_OPTIONS: ScopeConfig[] =
  Object.values(DEFAULT_SCOPES);

/**
 * Resolves a scope by id. Checks custom scopes first, then built-in defaults.
 * Returns undefined if no scope is specified (to trigger interactive selection).
 */
export function resolveScope(
  config: ReviewCodeChangesConfig,
  scopeId?: string,
): ScopeConfig | undefined {
  if (!scopeId) {
    return undefined;
  }

  // First check custom scopes by id
  const customScope = config.scope?.find((s) => s.id === scopeId);
  if (customScope) {
    return customScope;
  }

  // Then check built-in defaults
  return DEFAULT_SCOPES[scopeId as keyof typeof DEFAULT_SCOPES];
}

/**
 * Get all available scope ids (built-in + custom).
 */
export function getAvailableScopes(config: ReviewCodeChangesConfig): string[] {
  // If custom scopes are configured, only show those
  if (config.scope && config.scope.length > 0) {
    return config.scope.map((s) => s.id);
  }
  // Otherwise show built-in defaults
  return Object.keys(DEFAULT_SCOPES);
}

/**
 * Attempts to get file count synchronously from a scope.
 * Returns null if showFileCount is falsy or if getFiles returns a Promise.
 * When showFileCount is falsy, getFiles is not called (lazy evaluation).
 */
export function tryGetFileCountSync(
  scope: ScopeConfig & { showFileCount?: boolean },
  ctx: ScopeContext,
): number | null {
  if (!scope.showFileCount) {
    return null;
  }

  try {
    const result = scope.getFiles(ctx);
    if (Array.isArray(result)) {
      return result.length;
    }
    // Promise, can't get count synchronously
    return null;
  } catch {
    return null;
  }
}

/**
 * Converts scope configs to CLI select options with file counts.
 */
export function scopeConfigsToOptions(
  scopes: ScopeConfig[],
  ctx: ScopeContext,
): Array<{ value: string; label: string }> {
  return scopes.map((s) => {
    const fileCount = tryGetFileCountSync(s, ctx);
    return {
      value: s.id,
      label: fileCount !== null ? `${s.label} (${fileCount} files)` : s.label,
    };
  });
}
