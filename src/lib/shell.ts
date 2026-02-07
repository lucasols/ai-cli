export {
  runCmd,
  runCmdSilent,
  runCmdSilentUnwrap,
  runCmdUnwrap,
} from '@ls-stack/node-utils/runShellCmd';

export function showErrorAndExit(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}
