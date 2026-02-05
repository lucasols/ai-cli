import path from 'path';
import { estimateTokenCount } from 'tokenx';
import { formatNum, removeImportOnlyChangesFromDiff } from '../../lib/diff.ts';
import { git } from '../../lib/git.ts';

/**
 * Gets the diff for the selected files.
 */
export async function getDiffForFiles(
  files: string[],
  options: {
    baseBranch: string;
    excludeFiles?: string[];
    useStaged: boolean;
  },
): Promise<string> {
  const { baseBranch, excludeFiles, useStaged } = options;

  if (useStaged) {
    const rawDiff = await git.getStagedDiff({
      includeFiles: files,
      ignoreFiles: excludeFiles,
      silent: true,
    });

    const prDiff = removeImportOnlyChangesFromDiff(rawDiff);

    console.log(
      `📝 Staged diff: ${prDiff.split('\n').length} lines, ${formatNum(estimateTokenCount(prDiff))} tokens`,
    );

    return prDiff;
  }

  const rawDiff = await git.getDiffToBranch(baseBranch, {
    includeFiles: files,
    ignoreFiles: excludeFiles,
    silent: true,
  });

  const prDiff = removeImportOnlyChangesFromDiff(rawDiff);

  console.log(
    `📝 Diff: ${Math.round(prDiff.length / 1024)}KB, ${prDiff.split('\n').length} lines, ${formatNum(estimateTokenCount(prDiff))} tokens`,
  );

  return prDiff;
}

/**
 * Applies exclude patterns to a file list.
 */
export function applyExcludePatterns(
  files: string[],
  excludePatterns?: string[],
): string[] {
  if (!excludePatterns || excludePatterns.length === 0) {
    return files;
  }

  return files.filter(
    (file) =>
      !excludePatterns.some((pattern) => path.matchesGlob(file, pattern)),
  );
}
