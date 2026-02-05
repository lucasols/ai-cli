import { spawn } from 'child_process';
import { Result } from 't-result';

export type CmdResult = {
  out: string;
  stdout: string;
  stderr: string;
};

type Command = string | (string | null)[];

export function runCmd(
  args: Command,
  options: {
    silent?: boolean;
    cwd?: string;
    noColor?: boolean;
    timeout?: number;
  } = {},
): Promise<Result<CmdResult, Error>> {
  const { silent = true, cwd, noColor, timeout } = options;

  return new Promise((resolve) => {
    const [cmd = '', ...restArgs] =
      Array.isArray(args) ?
        args
          .filter((item): item is string => item !== null)
          .flatMap((item) =>
            item.startsWith('$') ? item.replace('$', '').split(' ') : item,
          )
      : args.split(' ');

    if (cmd.includes(' ')) {
      resolve(Result.err(new Error(`Command "${cmd}" cannot contain spaces`)));
      return;
    }

    const child = spawn(cmd, restArgs, {
      env: {
        ...process.env,
        ...(noColor ?
          { NO_COLOR: '1' }
        : { FORCE_COLOR: 'true', CLICOLOR_FORCE: '1' }),
      },
      cwd,
      timeout,
    });

    let stdout = '';
    let stderr = '';
    let out = '';

    child.stdout.on('data', (data: Buffer) => {
      const str = data.toString();
      stdout += str;
      out += str;

      if (!silent) {
        console.log(str);
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const str = data.toString();
      stderr += str;
      out += str;

      if (!silent) {
        console.log(str);
      }
    });

    child.on('error', (error) => {
      resolve(Result.err(new Error(`Failed to run command: ${error.message}`)));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve(
          Result.err(new Error(stderr || `Command failed with code ${code}`)),
        );
        return;
      }

      resolve(Result.ok({ out, stderr, stdout }));
    });
  });
}

export async function runCmdUnwrap(
  args: Command,
  options: { silent?: boolean; noColor?: boolean; cwd?: string } = {},
): Promise<string> {
  const result = await runCmd(args, options);

  if (result.error) {
    throw result.error;
  }

  return result.value.stdout;
}

export function runCmdSilent(command: Command) {
  return runCmd(command, { silent: true });
}

export function runCmdSilentUnwrap(command: Command) {
  return runCmdUnwrap(command, { silent: true });
}

export function showErrorAndExit(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}
