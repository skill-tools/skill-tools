import matter from 'gray-matter';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { countTokens } from './tokenizer.js';
import type {
	Diagnostic,
	ParseResult,
	Skill,
	SkillFileReference,
	SkillMetadata,
	SkillSection,
} from './types.js';

/**
 * Pattern for matching file references in markdown content.
 * Matches paths like `scripts/foo.sh`, `references/bar.md`, `assets/img.png`.
 * Intentionally narrow to avoid false positives on URLs or code snippets.
 */
const FILE_REFERENCE_PATTERN =
	/(?:^|\s|`)((?:scripts|references|assets)\/[\w./-]+(?:\.\w+)?)/gm;

/**
 * Pattern for matching markdown links to local files.
 * Matches [text](path.ext) where path doesn't start with http:// or https://
 */
const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g;

/**
 * Pattern for the skill name: lowercase letters, numbers, and hyphens, max 64 chars.
 * Per the Agent Skills spec (agentskills.io):
 * - 1-64 characters
 * - Lowercase alphanumeric and hyphens only
 * - Must not start or end with a hyphen
 * - Must not contain consecutive hyphens (--)
 */
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$/;
const CONSECUTIVE_HYPHENS = /--/;

/**
 * Parse a SKILL.md file from a file path.
 *
 * Reads the file, parses frontmatter and markdown body, extracts sections,
 * resolves file references, and counts tokens. Returns either a successful
 * parse result with the Skill object, or a failed result with diagnostics
 * explaining what went wrong.
 *
 * @param filePath - Absolute or relative path to a SKILL.md file
 * @returns ParseResult with either a Skill object or error diagnostics
 *
 * @example
 * ```ts
 * const result = await parseSkill('./my-skill/SKILL.md');
 * if (result.ok) {
 *   console.log(result.skill.metadata.name);
 * } else {
 *   console.error(result.diagnostics);
 * }
 * ```
 */
export async function parseSkill(filePath: string): Promise<ParseResult> {
	const absolutePath = isAbsolute(filePath) ? filePath : resolve(filePath);
	const dirPath = dirname(absolutePath);

	// Read the file
	let rawContent: string;
	try {
		rawContent = await readFile(absolutePath, 'utf-8');
	} catch (err) {
		return {
			ok: false,
			skill: null,
			diagnostics: [
				{
					ruleId: 'file-readable',
					severity: 'error',
					message: `Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
					file: absolutePath,
				},
			],
		};
	}

	// Check for empty file
	if (rawContent.trim().length === 0) {
		return {
			ok: false,
			skill: null,
			diagnostics: [
				{
					ruleId: 'file-not-empty',
					severity: 'error',
					message: 'SKILL.md file is empty',
					file: absolutePath,
				},
			],
		};
	}

	return parseSkillContent(rawContent, absolutePath, dirPath);
}

/**
 * Parse SKILL.md content from a raw string.
 * Useful when you already have the content in memory.
 *
 * @param rawContent - The raw SKILL.md file content
 * @param filePath - The file path (used for diagnostics and file reference resolution)
 * @param dirPath - The skill directory path (used for file reference resolution)
 * @returns ParseResult with either a Skill object or error diagnostics
 */
export function parseSkillContent(
	rawContent: string,
	filePath: string,
	dirPath: string,
): ParseResult {
	const diagnostics: Diagnostic[] = [];
	let hasErrors = false;

	// Parse frontmatter
	let parsed: matter.GrayMatterFile<string>;
	try {
		parsed = matter(rawContent);
	} catch (err) {
		return {
			ok: false,
			skill: null,
			diagnostics: [
				{
					ruleId: 'frontmatter-valid-yaml',
					severity: 'error',
					message: `Invalid YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`,
					file: filePath,
					line: 1,
				},
			],
		};
	}

	// Check frontmatter existence — use raw content check since gray-matter's
	// .matter property can be unreliable across successive calls
	const hasFrontmatter = rawContent.trimStart().startsWith('---') && Object.keys(parsed.data as Record<string, unknown>).length > 0;
	if (!hasFrontmatter) {
		diagnostics.push({
			ruleId: 'frontmatter-required',
			severity: 'error',
			message: 'SKILL.md must have YAML frontmatter between --- delimiters',
			file: filePath,
			line: 1,
			fix: 'Add frontmatter at the top of the file:\n---\nname: my-skill\ndescription: A short description\n---',
		});
		hasErrors = true;
	}

	// Validate metadata fields
	const data = parsed.data as Record<string, unknown>;

	// Validate name (REQUIRED per agentskills.io spec)
	if (data['name'] != null && typeof data['name'] !== 'string') {
		diagnostics.push({
			ruleId: 'name-type',
			severity: 'error',
			message: 'Frontmatter "name" field must be a string',
			file: filePath,
			line: 1,
			fix: 'Ensure the name is a string: name: my-skill-name',
		});
		hasErrors = true;
	} else if (data['name'] == null || (typeof data['name'] === 'string' && data['name'].trim().length === 0)) {
		diagnostics.push({
			ruleId: 'name-required',
			severity: 'error',
			message: 'Frontmatter must contain a "name" field (required by spec)',
			file: filePath,
			line: 1,
			fix: 'Add a name field: name: my-skill-name',
		});
		hasErrors = true;
	} else if (typeof data['name'] === 'string') {
		if (!NAME_PATTERN.test(data['name'])) {
			diagnostics.push({
				ruleId: 'name-format',
				severity: 'error',
				message: `Skill name "${data['name']}" is invalid. Must be 1-64 chars, lowercase letters, numbers, and hyphens only. Must not start or end with a hyphen`,
				file: filePath,
				line: 1,
				fix: `Use a name like: ${String(data['name']).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`,
			});
			hasErrors = true;
		} else if (CONSECUTIVE_HYPHENS.test(data['name'])) {
			diagnostics.push({
				ruleId: 'name-format',
				severity: 'error',
				message: `Skill name "${data['name']}" contains consecutive hyphens (--), which is not allowed`,
				file: filePath,
				line: 1,
				fix: `Replace consecutive hyphens with single hyphens: ${data['name'].replace(/--+/g, '-')}`,
			});
			hasErrors = true;
		}
	}

	// Validate description (REQUIRED per agentskills.io spec)
	if (data['description'] != null && typeof data['description'] !== 'string') {
		diagnostics.push({
			ruleId: 'description-type',
			severity: 'error',
			message: 'Frontmatter "description" field must be a string',
			file: filePath,
			line: 1,
			fix: 'Ensure the description is a string: description: "A clear description"',
		});
		hasErrors = true;
	} else if (data['description'] == null || (typeof data['description'] === 'string' && data['description'].trim().length === 0)) {
		diagnostics.push({
			ruleId: 'description-required',
			severity: 'error',
			message: 'Frontmatter must contain a "description" field (required by spec)',
			file: filePath,
			line: 1,
			fix: 'Add a description: description: "What this skill does and when to use it"',
		});
		hasErrors = true;
	} else if (typeof data['description'] === 'string') {
		const descLen = data['description'].length;
		if (descLen < 10) {
			diagnostics.push({
				ruleId: 'description-length',
				severity: 'warning',
				message: `Description is too short (${descLen} chars). Should be at least 50 characters for effective agent routing`,
				file: filePath,
				line: 1,
				fix: 'Expand the description to explain what the skill does, when to use it, and what triggers it',
			});
		} else if (descLen > 1024) {
			diagnostics.push({
				ruleId: 'description-length',
				severity: 'error',
				message: `Description exceeds max length (${descLen} chars). Must be at most 1,024 characters per spec`,
				file: filePath,
				line: 1,
				fix: 'Shorten the description to the essential information. Move details to the instructions body',
			});
			hasErrors = true;
		}
	}

	// Check markdown body
	const body = parsed.content.trim();
	if (body.length === 0) {
		diagnostics.push({
			ruleId: 'body-required',
			severity: 'error',
			message: 'SKILL.md must have markdown content after the frontmatter',
			file: filePath,
			fix: 'Add instructions below the frontmatter that teach an agent how to use this skill',
		});
		hasErrors = true;
	}

	// Parse sections
	const sections = parseSections(parsed.content, filePath);

	// Extract file references
	const fileReferences = extractFileReferences(parsed.content, filePath, dirPath);

	// Check for missing referenced files
	for (const ref of fileReferences) {
		if (!ref.exists) {
			diagnostics.push({
				ruleId: 'file-reference-exists',
				severity: 'error',
				message: `Referenced file not found: ${ref.path}`,
				file: filePath,
				line: ref.line,
				fix: `Create the file at ${ref.path} or remove the reference`,
			});
			hasErrors = true;
		}
	}

	// Count tokens
	const tokenCount = countTokens(rawContent);
	if (tokenCount > 5000) {
		diagnostics.push({
			ruleId: 'token-budget',
			severity: 'warning',
			message: `Token count (${tokenCount}) exceeds the recommended 5,000 token budget`,
			file: filePath,
			fix: 'Move detailed content to references/ directory to keep the main SKILL.md lean',
		});
	}

	// Build metadata from all frontmatter fields
	const knownFields = ['name', 'description', 'version'];
	const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
	const metadata: SkillMetadata = {
		...(typeof data['name'] === 'string' ? { name: data['name'] } : {}),
		...(typeof data['description'] === 'string' ? { description: data['description'] } : {}),
		...(data['version'] != null ? { version: String(data['version']) } : {}),
		...Object.fromEntries(
			Object.entries(data).filter(([k]) => !knownFields.includes(k) && !dangerousKeys.has(k)),
		),
	};

	if (hasErrors) {
		return {
			ok: false,
			skill: null,
			diagnostics,
		};
	}

	const lineCount = body.split('\n').length;

	const skill: Skill = {
		metadata,
		body,
		sections,
		fileReferences,
		filePath,
		dirPath,
		tokenCount,
		lineCount,
		rawContent,
	};

	return { ok: true, skill, diagnostics };
}

/**
 * Parse the markdown body into sections based on headings.
 */
function parseSections(content: string, _filePath: string): SkillSection[] {
	const lines = content.split('\n');
	const sections: SkillSection[] = [];
	let currentSection: { heading: string; depth: number; line: number; lines: string[] } | null =
		null;

	// Calculate the frontmatter offset (lines before content)
	// gray-matter strips the frontmatter, so we need to count from line 1 of the content
	const frontmatterOffset = 0; // Sections are relative to the content start

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

		if (headingMatch) {
			// Save previous section
			if (currentSection) {
				sections.push({
					heading: currentSection.heading,
					depth: currentSection.depth,
					content: currentSection.lines.join('\n').trim(),
					line: currentSection.line,
				});
			}

			currentSection = {
				heading: headingMatch[2]!,
				depth: headingMatch[1]!.length,
				line: frontmatterOffset + i + 1,
				lines: [],
			};
		} else if (currentSection) {
			currentSection.lines.push(line);
		}
	}

	// Don't forget the last section
	if (currentSection) {
		sections.push({
			heading: currentSection.heading,
			depth: currentSection.depth,
			content: currentSection.lines.join('\n').trim(),
			line: currentSection.line,
		});
	}

	return sections;
}

/**
 * Extract file references from the markdown body.
 * Looks for paths starting with scripts/, references/, or assets/.
 */
function extractFileReferences(
	content: string,
	_filePath: string,
	dirPath: string,
): SkillFileReference[] {
	const references: SkillFileReference[] = [];
	const seen = new Set<string>();
	const lines = content.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		let match: RegExpExecArray | null;

		// Match directory-prefixed paths: scripts/, references/, assets/
		FILE_REFERENCE_PATTERN.lastIndex = 0;
		while ((match = FILE_REFERENCE_PATTERN.exec(line)) !== null) {
			const refPath = match[1]!;
			if (seen.has(refPath)) continue;
			seen.add(refPath);

			const absoluteRefPath = resolve(dirPath, refPath);
			// Guard against path traversal — reference must stay within skill directory
			if (!absoluteRefPath.startsWith(resolve(dirPath) + '/')) continue;
			references.push({
				path: refPath,
				line: i + 1,
				exists: existsSync(absoluteRefPath),
			});
		}

		// Match markdown links to local files: [text](local-file.md)
		MARKDOWN_LINK_PATTERN.lastIndex = 0;
		while ((match = MARKDOWN_LINK_PATTERN.exec(line)) !== null) {
			const refPath = match[2]!;
			// Skip anchors, data URIs, and already-seen paths
			if (refPath.startsWith('#') || refPath.startsWith('data:') || seen.has(refPath)) continue;
			seen.add(refPath);

			const absoluteRefPath = resolve(dirPath, refPath);
			// Guard against path traversal — reference must stay within skill directory
			if (!absoluteRefPath.startsWith(resolve(dirPath) + '/')) continue;
			references.push({
				path: refPath,
				line: i + 1,
				exists: existsSync(absoluteRefPath),
			});
		}
	}

	return references;
}
