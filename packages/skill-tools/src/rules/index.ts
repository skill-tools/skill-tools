import { consistentHeadings } from './consistent-headings.js';
import { descriptionSpecificity } from './description-specificity.js';
import { descriptionTriggerKeywords } from './description-trigger-keywords.js';
import { instructionsHasErrorHandling } from './instructions-has-error-handling.js';
import { instructionsHasExamples } from './instructions-has-examples.js';
import { noHardcodedPaths } from './no-hardcoded-paths.js';
import { noSecrets } from './no-secrets.js';
import { progressiveDisclosure } from './progressive-disclosure.js';
import type { RuleDefinition } from './types.js';

export type { RuleConfig, RuleDefinition, RulesConfig } from './types.js';

/**
 * All built-in lint rules, keyed by rule ID.
 */
export const builtinRules: ReadonlyMap<string, RuleDefinition> = new Map([
	[descriptionSpecificity.id, descriptionSpecificity],
	[descriptionTriggerKeywords.id, descriptionTriggerKeywords],
	[progressiveDisclosure.id, progressiveDisclosure],
	[noHardcodedPaths.id, noHardcodedPaths],
	[noSecrets.id, noSecrets],
	[instructionsHasExamples.id, instructionsHasExamples],
	[instructionsHasErrorHandling.id, instructionsHasErrorHandling],
	[consistentHeadings.id, consistentHeadings],
]);

/**
 * The "recommended" preset: default severity for each rule.
 */
export const recommendedConfig: Record<string, string> = Object.fromEntries(
	Array.from(builtinRules.values()).map((rule) => [rule.id, rule.defaultSeverity]),
);
