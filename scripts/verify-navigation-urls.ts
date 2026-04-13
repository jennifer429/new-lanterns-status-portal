/**
 * verify-navigation-urls.ts
 *
 * Static analysis script that scans the client source for navigation links
 * and verifies they use the correct 2-slug URL pattern (/org/:clientSlug/:orgSlug/:subPage).
 *
 * Catches the bug where links are built with only orgSlug (e.g. /org/${orgSlug}/intake)
 * instead of the correct /org/${clientSlug}/${orgSlug}/intake.
 *
 * Usage: npx tsx scripts/verify-navigation-urls.ts
 */

import fs from "fs";
import path from "path";

const CLIENT_SRC = path.resolve(import.meta.dirname ?? __dirname, "../client/src");

// Sub-pages that require the /org/:clientSlug/:orgSlug/:subPage pattern
const SUB_PAGES = [
  "intake",
  "implement",
  "validation",
  "workflows",
  "specs",
  "connectivity",
  "tasks",
  "complete",
  "library",
];

// Patterns that indicate a BROKEN link (only 1 dynamic slug before a sub-page)
// e.g. `/org/${orgSlug}/intake` or `/org/${slug}/validation`
const BROKEN_PATTERNS = SUB_PAGES.map((sp) => ({
  subPage: sp,
  // Matches:  /org/${someVar}/subPage  where there's only ONE interpolation before the sub-page
  regex: new RegExp(
    `\`/org/\\$\\{[^}]+\\}/${sp}\``,
    "g"
  ),
}));

// Pattern that indicates a CORRECT link (2 dynamic slugs before a sub-page)
// e.g. `/org/${clientSlug}/${orgSlug}/intake`
const CORRECT_PATTERN = SUB_PAGES.map((sp) =>
  new RegExp(`\`/org/\\$\\{[^}]+\\}/\\$\\{[^}]+\\}/${sp}\``)
);

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsxFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// Files that are expected to have single-slug patterns (legacy redirect handlers)
const ALLOWLISTED_FILES = new Set(["App.tsx"]);

let totalIssues = 0;
let totalFilesScanned = 0;
let totalCorrectLinks = 0;

const files = getAllTsxFiles(CLIENT_SRC);

console.log("=== Navigation URL Verification ===\n");
console.log(`Scanning ${files.length} files in ${CLIENT_SRC}\n`);

for (const filePath of files) {
  const relPath = path.relative(CLIENT_SRC, filePath);
  const basename = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  totalFilesScanned++;

  // Check for broken patterns
  for (const { subPage, regex } of BROKEN_PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Check if this is actually a correct 2-slug pattern
      const matchStr = match[0];
      const isCorrect = CORRECT_PATTERN.some((cp) => cp.test(matchStr));

      if (isCorrect) {
        totalCorrectLinks++;
        continue;
      }

      // Check if the file is allowlisted (e.g. App.tsx legacy redirect handlers)
      if (ALLOWLISTED_FILES.has(basename)) {
        continue;
      }

      // Find line number and check if this is a ternary fallback
      // (the same line also contains the correct 2-slug version)
      const idx = match.index;
      let lineNo = 1;
      for (let i = 0; i < idx && i < content.length; i++) {
        if (content[i] === "\n") lineNo++;
      }

      // Check if nearby lines contain a correct 2-slug version (ternary fallback pattern)
      // e.g. `clientSlug ? /org/${clientSlug}/${slug}/complete\n : /org/${slug}/complete`
      const nearbyLines = lines.slice(Math.max(0, lineNo - 3), lineNo + 2).join("\n");
      const correctNearby = CORRECT_PATTERN.some((cp) => cp.test(nearbyLines));
      if (correctNearby) {
        // This is a ternary with correct primary + legacy fallback — safe
        continue;
      }

      totalIssues++;
      console.log(
        `  BROKEN  ${relPath}:${lineNo} — /${subPage} link uses single slug`
      );
      console.log(`          ${lineText.trim()}\n`);
    }
  }

  // Count correct links
  for (const cp of CORRECT_PATTERN) {
    const matches = content.match(new RegExp(cp.source, "g"));
    if (matches) {
      totalCorrectLinks += matches.length;
    }
  }
}

// Also check for setLocation calls with single slug
console.log("--- Checking setLocation calls ---\n");

for (const filePath of files) {
  const relPath = path.relative(CLIENT_SRC, filePath);
  const basename = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  if (ALLOWLISTED_FILES.has(basename)) continue;

  for (const sp of SUB_PAGES) {
    // Match setLocation(`/org/${var}/${subPage}`) - single slug
    const singleSlugRegex = new RegExp(
      `setLocation\\(\`/org/\\$\\{[^}]+\\}/${sp}\``,
      "g"
    );
    // Match setLocation(`/org/${var}/${var}/${subPage}`) - correct 2-slug
    const doubleSlugRegex = new RegExp(
      `setLocation\\(\`/org/\\$\\{[^}]+\\}/\\$\\{[^}]+\\}/${sp}\``
    );

    let match;
    while ((match = singleSlugRegex.exec(content)) !== null) {
      const matchStr = match[0];
      if (doubleSlugRegex.test(matchStr)) continue; // It's correct

      const idx = match.index;
      let lineNo = 1;
      for (let i = 0; i < idx && i < content.length; i++) {
        if (content[i] === "\n") lineNo++;
      }

      // Check if the same line contains a correct 2-slug version (ternary fallback)
      const lineText = lines[lineNo - 1] || "";
      const hasCorrectVersion = new RegExp(
        `/org/\\$\\{[^}]+\\}/\\$\\{[^}]+\\}/${sp}`
      ).test(lineText);
      if (hasCorrectVersion) continue;

      totalIssues++;
      console.log(
        `  BROKEN  ${relPath}:${lineNo} — setLocation to /${sp} uses single slug`
      );
      console.log(`          ${lineText.trim()}\n`);
    }
  }
}

console.log("=== Summary ===");
console.log(`Files scanned:  ${totalFilesScanned}`);
console.log(`Correct links:  ${totalCorrectLinks}`);
console.log(`Broken links:   ${totalIssues}`);
console.log("");

if (totalIssues > 0) {
  console.log(
    "FAIL: Found broken navigation links that use a single slug instead of clientSlug + orgSlug."
  );
  console.log(
    "Fix: Use `/org/${clientSlug}/${orgSlug}/<subPage>` pattern. See CLAUDE.md 'URL Slug System' section."
  );
  process.exit(1);
} else {
  console.log("PASS: All navigation links use the correct 2-slug URL pattern.");
  process.exit(0);
}
