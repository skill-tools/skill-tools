import { readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

/**
 * Information about a discovered skill in the filesystem.
 */
export interface SkillLocation {
	/** Absolute path to the SKILL.md file */
	readonly skillFile: string;
	/** Absolute path to the skill directory */
	readonly directory: string;
	/** The directory name (used as a fallback identifier) */
	readonly dirName: string;
}

/**
 * Resolve all SKILL.md files in a directory tree.
 *
 * Searches for SKILL.md files in the given path. If the path itself
 * contains a SKILL.md, returns just that one. If the path is a directory,
 * searches one level deep for subdirectories containing SKILL.md files.
 *
 * @param searchPath - Absolute or relative path to search
 * @returns Array of discovered skill locations
 *
 * @example
 * ```ts
 * // Single skill directory
 * const skills = await resolveSkillFiles('./my-skill/');
 * // => [{ skillFile: '/abs/path/my-skill/SKILL.md', ... }]
 *
 * // Directory of skills
 * const skills = await resolveSkillFiles('./skills/');
 * // => [
 * //   { skillFile: '/abs/path/skills/deploy/SKILL.md', ... },
 * //   { skillFile: '/abs/path/skills/test-runner/SKILL.md', ... },
 * // ]
 * ```
 */
export async function resolveSkillFiles(searchPath: string): Promise<SkillLocation[]> {
	const absolutePath = resolve(searchPath);
	const locations: SkillLocation[] = [];

	// Check if the path itself is a SKILL.md file
	const pathStat = await stat(absolutePath).catch(() => null);
	if (!pathStat) {
		return locations;
	}

	if (pathStat.isFile() && basename(absolutePath) === 'SKILL.md') {
		const directory = resolve(absolutePath, '..');
		locations.push({
			skillFile: absolutePath,
			directory,
			dirName: basename(directory),
		});
		return locations;
	}

	if (!pathStat.isDirectory()) {
		return locations;
	}

	// Check if this directory contains a SKILL.md
	const directSkill = join(absolutePath, 'SKILL.md');
	const directStat = await stat(directSkill).catch(() => null);
	if (directStat?.isFile()) {
		locations.push({
			skillFile: directSkill,
			directory: absolutePath,
			dirName: basename(absolutePath),
		});
		return locations;
	}

	// Search one level deep for subdirectories with SKILL.md
	const entries = await readdir(absolutePath, { withFileTypes: true });
	const subdirChecks = entries
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
		.map(async (entry) => {
			const subdir = join(absolutePath, entry.name);
			const skillFile = join(subdir, 'SKILL.md');
			const skillStat = await stat(skillFile).catch(() => null);
			if (skillStat?.isFile()) {
				locations.push({
					skillFile,
					directory: subdir,
					dirName: entry.name,
				});
			}
		});

	await Promise.all(subdirChecks);

	// Sort by directory name for consistent ordering
	locations.sort((a, b) => a.dirName.localeCompare(b.dirName));

	return locations;
}
