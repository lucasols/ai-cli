import { diffParser } from '@ls-stack/utils/diffParser';

export function formatNum(num: number): string {
  return num.toLocaleString('en-US');
}

function isImportOrExportLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  return (
    trimmed.startsWith('import ') ||
    trimmed.startsWith('export ') ||
    trimmed.startsWith('} from ') ||
    trimmed.includes('= require(') ||
    trimmed.includes('import(') ||
    /^import\s*\{/.test(trimmed) ||
    /^export\s*\{/.test(trimmed) ||
    (trimmed.startsWith('type ') && trimmed.includes('import('))
  );
}

export function removeImportOnlyChangesFromDiff(diff: string): string {
  if (!diff.trim()) return '';

  const parsedFiles = diffParser(diff);
  const filteredDiffs: string[] = [];

  for (const file of parsedFiles) {
    // Keep binary files
    if (file.type === 'binary') {
      filteredDiffs.push(file.rawDiff);
      continue;
    }

    // Check if file has any actual changes (add/del, not just normal context)
    const hasAnyChanges = file.chunks.some((chunk) =>
      chunk.changes.some((change) => change.type !== 'normal'),
    );

    // Keep files with no actual changes (metadata only / context only)
    if (!hasAnyChanges) {
      filteredDiffs.push(file.rawDiff);
      continue;
    }

    const hasNonImportChanges = file.chunks.some((chunk) =>
      chunk.changes.some((change) => {
        if (change.type === 'normal') return false;
        // Remove leading +/- from content
        const lineContent = change.content.slice(1);
        return !isImportOrExportLine(lineContent);
      }),
    );

    if (hasNonImportChanges) {
      filteredDiffs.push(file.rawDiff);
    }
  }

  return filteredDiffs.join('\n');
}
