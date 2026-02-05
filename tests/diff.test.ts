import { describe, it, expect } from 'vitest';
import { removeImportOnlyChangesFromDiff } from '../src/lib/diff.ts';

describe('removeImportOnlyChangesFromDiff', () => {
  it('returns empty string for empty diff', () => {
    expect(removeImportOnlyChangesFromDiff('')).toBe('');
  });

  it('keeps file with non-import changes', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 import { foo } from './foo';
+import { bar } from './bar';

-const x = 1;
+const x = 2;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe(diff);
  });

  it('removes file with only import additions', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
 import { foo } from './foo';
+import { bar } from './bar';

 const x = 1;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe('');
  });

  it('removes file with only import removals', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,2 @@
 import { foo } from './foo';
-import { bar } from './bar';

 const x = 1;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe('');
  });

  it('removes file with only export changes', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
 const x = 1;
+export { x };
+export { y } from './y';`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe('');
  });

  it('removes file with only require changes', () => {
    const diff = `diff --git a/src/index.js b/src/index.js
--- a/src/index.js
+++ b/src/index.js
@@ -1,2 +1,3 @@
 const foo = require('./foo');
+const bar = require('./bar');

 const x = 1;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe('');
  });

  it('removes file with only dynamic import changes', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
 const foo = await import('./foo');
+const bar = await import('./bar');

 const x = 1;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe('');
  });

  it('removes file with only type import changes', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
 import type { Foo } from './foo';
+type Bar = import('./bar').Bar;

 const x = 1;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe('');
  });

  it('keeps file with multiline import changes (limitation: inner lines not detected)', () => {
    // Note: The function doesn't detect changes inside multiline imports like "bar,"
    // because it only matches lines starting with import/export keywords
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,4 +1,5 @@
 import {
   foo,
+  bar,
 } from './utils';

 const x = 1;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe(diff);
  });

  it('keeps multiple files, removes import-only ones', () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 import { foo } from './foo';
+import { bar } from './bar';
 const x = 1;
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,2 +1,3 @@
 import { foo } from './foo';

-const x = 1;
+const x = 2;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toContain('diff --git a/src/b.ts');
    expect(result).not.toContain('diff --git a/src/a.ts');
  });

  it('keeps file with no changed lines (metadata only)', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,2 @@
 import { foo } from './foo';
 const x = 1;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe(diff);
  });

  it('handles import with destructuring on same line', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
+import { a, b, c } from './utils';

 const x = 1;`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe('');
  });

  it('handles export with destructuring on same line', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
 const x = 1;
+export { a, b, c };`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe('');
  });

  it('keeps file when function code changes alongside imports', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,6 @@
+import { helper } from './helper';

 function main() {
-  console.log('hello');
+  helper();
 }`;

    const result = removeImportOnlyChangesFromDiff(diff);
    expect(result).toBe(diff);
  });
});
