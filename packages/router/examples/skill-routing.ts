/**
 * Demo: Skill routing with BM25 using @skill-tools/router
 *
 * Run: npx tsx examples/skill-routing.ts
 */
import { SkillRouter } from '@skill-tools/router';

const SKILLS = [
	{
		name: 'deploy-vercel',
		description: 'Deploy applications to Vercel. Use when pushing code to production on Vercel.',
	},
	{
		name: 'deploy-aws',
		description: 'Deploy to AWS. Use when deploying to Amazon Web Services EC2, Lambda, or S3.',
	},
	{
		name: 'run-tests',
		description: 'Execute unit tests, integration tests, and end-to-end test suites with coverage.',
	},
	{
		name: 'lint-code',
		description: 'Run ESLint, Biome, or Prettier to check and fix code formatting and style.',
	},
	{
		name: 'database-migrate',
		description: 'Run database migrations using Prisma, Drizzle, or raw SQL migration files.',
	},
	{
		name: 'docker-build',
		description: 'Build Docker images and manage containers. Use for containerization tasks.',
	},
	{
		name: 'git-workflow',
		description: 'Manage Git branches, commits, merges, and pull requests.',
	},
];

async function main() {
	const router = new SkillRouter();
	await router.indexSkills(SKILLS);
	console.log(`Indexed ${router.count} skills (BM25 engine)\n`);

	// --- Query 1: deployment ---
	console.log('=== Query: "deploy my app to production" ===');
	const deployResults = await router.select('deploy my app to production', { topK: 3 });
	for (const r of deployResults) {
		console.log(`  ${r.skill.padEnd(20)} score: ${r.score.toFixed(3)}`);
	}

	// --- Query 2: testing ---
	console.log('\n=== Query: "run the test suite" ===');
	const testResults = await router.select('run the test suite', { topK: 3 });
	for (const r of testResults) {
		console.log(`  ${r.skill.padEnd(20)} score: ${r.score.toFixed(3)}`);
	}

	// --- Query 3: database ---
	console.log('\n=== Query: "database schema migrations prisma" ===');
	const dbResults = await router.select('database schema migrations prisma', { topK: 3 });
	for (const r of dbResults) {
		console.log(`  ${r.skill.padEnd(20)} score: ${r.score.toFixed(3)}`);
	}

	// --- Query 4: with boost + exclude ---
	console.log('\n=== Query: "deploy" (boost=docker-build, exclude=deploy-aws) ===');
	const filtered = await router.select('deploy', {
		topK: 3,
		boost: ['docker-build'],
		exclude: ['deploy-aws'],
	});
	for (const r of filtered) {
		console.log(`  ${r.skill.padEnd(20)} score: ${r.score.toFixed(3)}`);
	}

	// --- Save / Load snapshot ---
	console.log('\n=== Save & Restore Snapshot ===');
	const snapshot = router.save();
	console.log(`  Provider: ${snapshot.embeddingProvider}`);
	console.log(`  Skills:   ${snapshot.skillNames.length}`);

	const restored = SkillRouter.fromSnapshot(snapshot);
	const restoredResults = await restored.select('docker containers', { topK: 2 });
	console.log(`  Restored query "docker containers":`);
	for (const r of restoredResults) {
		console.log(`    ${r.skill.padEnd(20)} score: ${r.score.toFixed(3)}`);
	}

	// --- Conflict detection ---
	console.log('\n=== Conflict Detection (threshold: 0.3) ===');
	const conflicts = await router.detectConflicts(0.3);
	if (conflicts.length > 0) {
		for (const c of conflicts) {
			console.log(`  Conflict: [${c.skills.join(', ')}]  similarity: ${c.similarity.toFixed(3)}`);
		}
	} else {
		console.log('  No conflicts detected');
	}
}

main().catch(console.error);
