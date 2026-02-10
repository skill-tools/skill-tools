/**
 * Severity levels for diagnostic messages.
 * Follows the same hierarchy as LSP diagnostics.
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * A diagnostic message produced by validation or linting.
 * Contains the location, severity, and suggested fix for an issue.
 */
export interface Diagnostic {
	/** Unique rule identifier, e.g. "frontmatter-required" or "description-specificity" */
	readonly ruleId: string;
	/** Severity of the diagnostic */
	readonly severity: DiagnosticSeverity;
	/** Human-readable message describing the issue */
	readonly message: string;
	/** Optional file path where the issue was found */
	readonly file?: string;
	/** Optional 1-based line number in the file */
	readonly line?: number;
	/** Optional 1-based column number in the file */
	readonly column?: number;
	/** Optional suggestion for how to fix the issue */
	readonly fix?: string;
}

/**
 * YAML frontmatter metadata for a SKILL.md file.
 *
 * Based on the Agent Skills specification:
 * - Claude Code: https://code.claude.com/docs/en/skills
 * - Codex: https://developers.openai.com/codex/skills/
 *
 * Both `name` and `description` are strongly recommended.
 * All other fields are optional platform-specific extensions.
 */
export interface SkillMetadata {
	/**
	 * Skill name identifier. Becomes the /slash-command.
	 * Lowercase letters, numbers, and hyphens only (max 64 characters).
	 * If omitted, the directory name is used as fallback.
	 */
	readonly name?: string;

	/**
	 * Description used for agent discovery and routing.
	 * Should explain what the skill does AND when to use it.
	 * If omitted, the first paragraph of markdown content may be used.
	 */
	readonly description?: string;

	/** Semantic version of the skill */
	readonly version?: string;

	/**
	 * Hint shown during autocomplete for expected arguments.
	 * Example: "[issue-number]" or "[filename] [format]"
	 */
	readonly 'argument-hint'?: string;

	/**
	 * Set to true to prevent the agent from automatically loading this skill.
	 * Use for workflows you want to trigger manually with /name.
	 */
	readonly 'disable-model-invocation'?: boolean;

	/**
	 * Set to false to hide from the / menu.
	 * Use for background knowledge users shouldn't invoke directly.
	 */
	readonly 'user-invocable'?: boolean;

	/**
	 * Tools the agent can use without permission when this skill is active.
	 * Comma-separated tool names, e.g. "Read, Grep, Glob"
	 */
	readonly 'allowed-tools'?: string;

	/**
	 * Model to use when this skill is active.
	 */
	readonly model?: string;

	/**
	 * Set to "fork" to run in a forked subagent context.
	 */
	readonly context?: 'fork' | string;

	/**
	 * Which subagent type to use when context: fork is set.
	 * Options: "Explore", "Plan", "general-purpose", or a custom agent name.
	 */
	readonly agent?: string;

	/**
	 * Hooks scoped to this skill's lifecycle.
	 */
	readonly hooks?: Record<string, unknown>;

	/** Arbitrary additional metadata key-value pairs */
	readonly [key: string]: unknown;
}

/**
 * A parsed section of a SKILL.md file's markdown body.
 * Represents a heading and its content.
 */
export interface SkillSection {
	/** Heading text (without the # prefix) */
	readonly heading: string;
	/** Heading depth (1-6) */
	readonly depth: number;
	/** Raw markdown content under this heading */
	readonly content: string;
	/** 1-based line number where this section starts */
	readonly line: number;
}

/**
 * A file referenced from within the skill directory.
 * Used for tracking file reference integrity.
 */
export interface SkillFileReference {
	/** The path as written in the SKILL.md (relative) */
	readonly path: string;
	/** 1-based line number where this reference appears */
	readonly line: number;
	/** Whether the referenced file actually exists on disk */
	readonly exists: boolean;
}

/**
 * Complete parsed representation of a SKILL.md file.
 * This is the primary data structure that all tools operate on.
 */
export interface Skill {
	/** Parsed YAML frontmatter metadata */
	readonly metadata: SkillMetadata;
	/** Raw markdown body (everything after frontmatter) */
	readonly body: string;
	/** Parsed sections from the markdown body */
	readonly sections: readonly SkillSection[];
	/** File references found in the markdown body */
	readonly fileReferences: readonly SkillFileReference[];
	/** Absolute path to the SKILL.md file */
	readonly filePath: string;
	/** Absolute path to the skill directory (parent of SKILL.md) */
	readonly dirPath: string;
	/** Token count of the full SKILL.md content */
	readonly tokenCount: number;
	/** Line count of the SKILL.md body (excluding frontmatter) */
	readonly lineCount: number;
	/** Raw content of the entire SKILL.md file */
	readonly rawContent: string;
}

/**
 * Result of parsing a SKILL.md file.
 * Either succeeds with a Skill object or fails with diagnostics.
 */
export type ParseResult =
	| { readonly ok: true; readonly skill: Skill; readonly diagnostics: readonly Diagnostic[] }
	| { readonly ok: false; readonly skill: null; readonly diagnostics: readonly Diagnostic[] };

/**
 * Quality score for a single dimension.
 */
export interface DimensionScore {
	/** Points earned in this dimension */
	readonly score: number;
	/** Maximum points possible for this dimension */
	readonly max: number;
	/** Human-readable label for this dimension */
	readonly label: string;
	/** Details about what contributed to the score */
	readonly details?: string;
}

/**
 * Complete quality score breakdown.
 */
export interface QualityScore {
	/** Overall score (0-100) */
	readonly score: number;
	/** Per-dimension breakdowns */
	readonly dimensions: Record<string, DimensionScore>;
	/** Actionable suggestions for improvement */
	readonly suggestions: readonly ScoreSuggestion[];
}

/**
 * A suggestion for improving a quality score.
 */
export interface ScoreSuggestion {
	/** Human-readable suggestion */
	readonly message: string;
	/** Estimated point improvement if implemented */
	readonly pointsGain: number;
	/** Which dimension this suggestion applies to */
	readonly dimension: string;
}
