/**
 * Demo: Validate, lint, and score a SKILL.md using skill-tools
 *
 * Run: npx tsx examples/validate-and-score.ts
 */
import { parseSkillContent } from '@skill-tools/core';
import { lint, score } from 'skill-tools';

const SAMPLE = `---
name: run-tests
description: >-
  Execute unit tests, integration tests, and end-to-end test suites.
  Use when the user asks to run tests, check coverage, or verify code quality.
---

# Run Tests

Execute test suites for the current project.

## Steps

1. Detect the test framework (Jest, Vitest, Mocha, pytest, etc.)
2. Run the appropriate test command:
   \`\`\`bash
   npm test
   # or
   pnpm vitest run
   \`\`\`
3. Report results with pass/fail counts and coverage

## Error Handling

If tests fail:
- Show the failing test names and error messages
- Suggest common fixes for frequent failure patterns
- Check for missing dependencies or misconfigured test config
`;

const result = parseSkillContent(SAMPLE, '/demo/run-tests/SKILL.md', '/demo/run-tests');

if (!result.ok) {
	console.error('Parse failed:', result.diagnostics);
	process.exit(1);
}

const { skill } = result;
console.log(`Parsed "${skill.metadata.name}" successfully\n`);

// --- Lint ---
console.log('=== Lint Results ===');
const lintResult = lint(skill);
console.log(`  Errors:   ${lintResult.errorCount}`);
console.log(`  Warnings: ${lintResult.warningCount}`);
console.log(`  Info:     ${lintResult.infoCount}`);
if (lintResult.diagnostics.length > 0) {
	for (const d of lintResult.diagnostics) {
		console.log(`  [${d.severity}] ${d.ruleId}: ${d.message}`);
	}
} else {
	console.log('  All lint rules passed!');
}

// --- Score ---
console.log('\n=== Quality Score ===');
const scoreResult = score(skill);
console.log(`  Overall: ${scoreResult.score}/100\n`);
console.log('  Dimensions:');
for (const dim of Object.values(scoreResult.dimensions)) {
	const bar = '='.repeat(Math.round((dim.score / dim.max) * 20)).padEnd(20, '-');
	console.log(`    ${dim.label.padEnd(24)} [${bar}] ${dim.score}/${dim.max}`);
}

if (scoreResult.suggestions.length > 0) {
	console.log('\n  Suggestions:');
	for (const s of scoreResult.suggestions) {
		console.log(`    +${s.pointsGain}pts: ${s.message}`);
	}
}
