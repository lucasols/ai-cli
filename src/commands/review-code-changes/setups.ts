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
  const builtIn = Object.keys(reviewSetupConfigs);
  const custom = config.setup?.map((s) => s.label) ?? [];
  return [...builtIn, ...custom];
}
