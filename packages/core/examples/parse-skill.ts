/**
 * Demo: Parse a SKILL.md file using @skill-tools/core
 *
 * Run: npx tsx examples/parse-skill.ts
 */
import { countTokens, parseSkillContent } from '@skill-tools/core';

const SAMPLE_SKILL = `---
name: deploy-vercel
description: >-
  Deploy applications to Vercel. Use when the user wants to push
  code to production on Vercel's hosting platform.
version: "1.0"
---

# Deploy to Vercel

Deploy your application to Vercel's hosting platform.

## Prerequisites

- A Vercel account linked to your Git provider
- A \`vercel.json\` configuration file in your project root

## Steps

1. Run \`vercel login\` to authenticate
2. Run \`vercel --prod\` to deploy to production
3. Verify the deployment URL

## Error Handling

If deployment fails, check:
- Your \`vercel.json\` for syntax errors
- That your build command exits with code 0
`;

const result = parseSkillContent(SAMPLE_SKILL, '/demo/deploy-vercel/SKILL.md', '/demo/deploy-vercel');

if (result.ok) {
	const { skill } = result;
	console.log('=== Parsed Skill ===');
	console.log(`  Name:        ${skill.metadata.name}`);
	console.log(`  Description: ${skill.metadata.description}`);
	console.log(`  Version:     ${skill.metadata.version}`);
	console.log(`  Tokens:      ${skill.tokenCount}`);
	console.log(`  Lines:       ${skill.lineCount}`);
	console.log();

	console.log('=== Sections ===');
	for (const section of skill.sections) {
		console.log(`  ${'#'.repeat(section.depth)} ${section.heading}  (line ${section.line})`);
	}
	console.log();

	if (result.diagnostics.length > 0) {
		console.log('=== Diagnostics ===');
		for (const d of result.diagnostics) {
			console.log(`  [${d.severity}] ${d.ruleId}: ${d.message}`);
		}
	} else {
		console.log('No diagnostics (clean parse)');
	}
} else {
	console.error('Parse failed:');
	for (const d of result.diagnostics) {
		console.error(`  [${d.severity}] ${d.ruleId}: ${d.message}`);
	}
}

console.log();
console.log('=== Token Counting ===');
console.log(`  "Hello, world!"  => ${countTokens('Hello, world!')} tokens`);
console.log(`  Full SKILL.md    => ${countTokens(SAMPLE_SKILL)} tokens`);
