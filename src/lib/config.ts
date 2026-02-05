import { existsSync } from 'fs';
import { join } from 'path';

export type Config = {
  baseBranch?: string;
  excludePatterns?: string[];
  reviewInstructionsPath?: string;
  defaultSetup?:
    | 'veryLight'
    | 'lightGoogle'
    | 'mediumGoogle'
    | 'light'
    | 'medium'
    | 'heavy';
  logsDir?: string;
};

export function defineConfig(config: Config): Config {
  return config;
}

let cachedConfig: Config | undefined = undefined;

export async function loadConfig(cwd: string = process.cwd()): Promise<Config> {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  const configPath = join(cwd, 'ai-cli.config.ts');

  if (!existsSync(configPath)) {
    cachedConfig = {};
    return cachedConfig;
  }

  try {
    const configModule = (await import(configPath)) as { default?: Config };
    cachedConfig = configModule.default ?? {};
    return cachedConfig;
  } catch (error) {
    console.warn(`Warning: Failed to load config from ${configPath}:`, error);
    cachedConfig = {};
    return cachedConfig;
  }
}

export function clearConfigCache(): void {
  cachedConfig = undefined;
}
