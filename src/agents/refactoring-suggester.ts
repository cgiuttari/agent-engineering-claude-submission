import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { buildRefactoringSuggesterPrompt } from '../prompts/refactoring-suggester.prompt.js';

/**
 * Refactoring Suggester Agent
 *
 * Identifies structural improvements in source files: extract-function,
 * rename, modernize, simplify, and pattern-improvement opportunities.
 * Focuses on code that works but can be made cleaner — distinct from
 * quality analysis which targets broken or risky code.
 *
 * Tools:
 *   - Read  : load the full source file
 *   - Grep  : detect structural signals (long functions, old syntax, etc.)
 *   - Glob  : discover related files for context (e.g. callers, tests)
 *   - Skill : invoke /refactoring-patterns for clean-code and design-pattern guidance
 */
export function createRefactoringSuggester(filePath: string): AgentDefinition {
  return {
    description: `Identifies structural refactoring opportunities in source code:
extract-function, rename, modernize (e.g. callbacks → async/await), simplify, and
pattern-improvement. Use this agent when you need actionable before/after examples
to improve code clarity and maintainability — not for bug or security analysis.`,

    tools: ['Read', 'Grep', 'Glob', 'Skill'],

    prompt: buildRefactoringSuggesterPrompt(filePath),

    model: 'inherit',
  };
}
