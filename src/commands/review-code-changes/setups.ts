import { openai, type OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import type {
  CustomModelConfig,
  ReviewCodeChangesConfig,
  SetupConfig,
} from '../../lib/config.ts';
import type { Model, ReviewSetup } from './types.ts';

export const gpt5MiniModel: Model = {
  model: openai('gpt-5-mini'),
  config: {
    topP: false,
    providerOptions: {
      reasoningEffort: 'medium',
      reasoningSummary: 'auto',
    } satisfies OpenAIResponsesProviderOptions,
  },
};

export const gpt5Model: Model = {
  model: openai('gpt-5.2'),
  config: {
    topP: false,
    providerOptions: {
      reasoningEffort: 'medium',
      reasoningSummary: 'auto',
    } satisfies OpenAIResponsesProviderOptions,
  },
};

export const gpt5ModelHigh: Model = {
  model: openai('gpt-5.2'),
  config: {
    topP: false,
    providerOptions: {
      reasoningEffort: 'high',
      reasoningSummary: 'auto',
    } satisfies OpenAIResponsesProviderOptions,
  },
};

export type ReviewSetupConfig = {
  reviewers: Model[];
  validator: Model;
  formatter: Model;
};

export const reviewSetupConfigs: Record<ReviewSetup, ReviewSetupConfig> = {
  light: {
    reviewers: [gpt5Model],
    validator: gpt5ModelHigh,
    formatter: gpt5MiniModel,
  },
  medium: {
    reviewers: [gpt5ModelHigh, gpt5ModelHigh],
    validator: gpt5ModelHigh,
    formatter: gpt5MiniModel,
  },
  heavy: {
    reviewers: [gpt5ModelHigh, gpt5ModelHigh, gpt5ModelHigh, gpt5ModelHigh],
    validator: gpt5ModelHigh,
    formatter: gpt5MiniModel,
  },
};

export function isGoogleSetup(setup: ReviewSetup): boolean {
  return setup.endsWith('Google');
}

function toModel(cfg: CustomModelConfig): Model {
  return {
    model: cfg.model,
    label: cfg.label,
    config:
      cfg.providerOptions ?
        { providerOptions: cfg.providerOptions }
      : undefined,
  };
}

function convertCustomSetup(
  setup: SetupConfig,
  config: ReviewCodeChangesConfig,
): ReviewSetupConfig {
  const reviewers: Model[] = setup.reviewers.map(toModel);

  // Priority: setup.validator > config.defaultValidator > first reviewer
  const validator: Model =
    setup.validator ? toModel(setup.validator)
    : config.defaultValidator ? toModel(config.defaultValidator)
    : (reviewers[0] ?? gpt5ModelHigh);

  // Priority: setup.formatter > config.defaultFormatter > gpt5MiniModel
  const formatter: Model =
    setup.formatter ? toModel(setup.formatter)
    : config.defaultFormatter ? toModel(config.defaultFormatter)
    : gpt5MiniModel;

  return { reviewers, validator, formatter };
}

/**
 * Resolves a setup by name. Checks custom setups first, then built-in presets.
 * Returns undefined if no setup is specified (to trigger interactive selection).
 */
export function resolveSetup(
  config: ReviewCodeChangesConfig,
  cliSetup?: string,
): ReviewSetupConfig | undefined {
  if (!cliSetup) {
    return undefined;
  }

  // First check custom setups by label
  const customSetup = config.setup?.find((s) => s.label === cliSetup);
  if (customSetup) {
    return convertCustomSetup(customSetup, config);
  }

  // Then check built-in presets
  if (cliSetup in reviewSetupConfigs) {
    return reviewSetupConfigs[cliSetup as ReviewSetup];
  }

  return undefined;
}

/**
 * Get all available setup labels (built-in + custom).
 */
export function getAvailableSetups(config: ReviewCodeChangesConfig): string[] {
  // If custom setups are configured, only show those
  if (config.setup && config.setup.length > 0) {
    return config.setup.map((s) => s.label);
  }
  // Otherwise show built-in presets
  return Object.keys(reviewSetupConfigs);
}

/**
 * Built-in setup options that users can include in their config.
 * When custom setups are configured, they replace built-in options.
 * Use this export to include built-in options alongside custom ones:
 *
 * @example
 * ```typescript
 * import { defineConfig, BUILT_IN_SETUP_OPTIONS } from 'ai-cmds';
 *
 * export default defineConfig({
 *   reviewCodeChanges: {
 *     setup: [
 *       ...BUILT_IN_SETUP_OPTIONS,
 *       { label: 'myCustomSetup', reviewers: [...] },
 *     ],
 *   },
 * });
 * ```
 */
export const BUILT_IN_SETUP_OPTIONS: Record<
  'veryLight' | 'light' | 'medium' | 'heavy',
  SetupConfig
> = {
  veryLight: {
    label: 'veryLight',
    reviewers: [{ model: gpt5MiniModel.model }],
  },
  light: {
    label: 'light',
    reviewers: [{ model: gpt5Model.model }],
  },
  medium: {
    label: 'medium',
    reviewers: [
      {
        model: gpt5ModelHigh.model,
        providerOptions: { reasoningEffort: 'high' },
      },
      {
        model: gpt5ModelHigh.model,
        providerOptions: { reasoningEffort: 'high' },
      },
    ],
  },
  heavy: {
    label: 'heavy',
    reviewers: [
      {
        model: gpt5ModelHigh.model,
        providerOptions: { reasoningEffort: 'high' },
      },
      {
        model: gpt5ModelHigh.model,
        providerOptions: { reasoningEffort: 'high' },
      },
      {
        model: gpt5ModelHigh.model,
        providerOptions: { reasoningEffort: 'high' },
      },
      {
        model: gpt5ModelHigh.model,
        providerOptions: { reasoningEffort: 'high' },
      },
    ],
  },
};
