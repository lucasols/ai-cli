import { openai, type OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
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

export const gemini25ProModel: Model = { model: google('gemini-2.5-pro') };
export const gemini25FlashLiteModel: Model = {
  model: google('gemini-2.5-flash-lite'),
};

export type ReviewSetupConfig = {
  reviewers: Model[];
  validator: Model;
  formatter: Model;
};

export const reviewSetupConfigs: Record<ReviewSetup, ReviewSetupConfig> = {
  veryLight: {
    reviewers: [gpt5MiniModel],
    validator: gpt5ModelHigh,
    formatter: gpt5MiniModel,
  },
  lightGoogle: {
    reviewers: [gemini25ProModel],
    validator: gemini25ProModel,
    formatter: gemini25FlashLiteModel,
  },
  mediumGoogle: {
    reviewers: [gemini25ProModel, gemini25ProModel],
    validator: gemini25ProModel,
    formatter: gemini25FlashLiteModel,
  },
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
