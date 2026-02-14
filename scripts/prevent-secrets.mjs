import { execSync } from "node:child_process";

function runGit(args) {
  return execSync(`git ${args}`, { encoding: "utf8" });
}

const stagedFiles = runGit("diff --cached --name-only --diff-filter=ACMR")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const blockedPathPatterns = [/^\.env(?:\..+)?$/i, /^worker\/\.dev\.vars(?:\..+)?$/i];
const allowedPathPatterns = [/^\.env\.example$/i, /^worker\/\.dev\.vars\.example$/i];

const blockedFiles = stagedFiles.filter(
  (file) =>
    blockedPathPatterns.some((rx) => rx.test(file)) &&
    !allowedPathPatterns.some((rx) => rx.test(file))
);

if (blockedFiles.length) {
  console.error("Blocked commit: secret file(s) staged.");
  for (const file of blockedFiles) {
    console.error(`- ${file}`);
  }
  console.error("Keep secrets in untracked local env files only.");
  process.exit(1);
}

const addedLines = runGit("diff --cached --unified=0 --no-color")
  .split(/\r?\n/)
  .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  .map((line) => line.slice(1).trim())
  .filter(Boolean);

const placeholderPattern =
  /(example|placeholder|changeme|your_|dummy|sample|fake|xxxx|<[^>]+>)/i;

const secretPatterns = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\b(?:api[_-]?key|token|secret|password|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}["']?/i,
  /\b(?:VITE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)|AIRTABLE_TOKEN|OPENAI_API_KEY|UNSPLASH_ACCESS_KEY)\s*=\s*["']?[A-Za-z0-9_./+=-]{12,}["']?/,
];

const findings = [];
for (const line of addedLines) {
  if (placeholderPattern.test(line)) continue;
  if (secretPatterns.some((rx) => rx.test(line))) {
    findings.push(line);
  }
}

if (findings.length) {
  console.error("Blocked commit: possible secret(s) detected in staged changes.");
  for (const line of findings.slice(0, 5)) {
    console.error(`- ${line.slice(0, 140)}`);
  }
  console.error("Move secrets into local env files that are gitignored.");
  process.exit(1);
}
