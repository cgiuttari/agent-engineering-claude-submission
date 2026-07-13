import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { buildCodeQualityAnalyzerPrompt } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Code Quality Analyzer Agent
 *
 * Analyzes source files for security vulnerabilities, performance issues,
 * and maintainability concerns. Returns a structured CodeQualityResult.
 *
 * Tools:
 *   - Read  : read source files under analysis
 *   - Grep  : search for patterns (e.g. dangerous APIs, code smells)
 *   - Glob  : discover files matching a path pattern
 *   - Skill : invoke Claude Skills such as /javascript-best-practices
 *             or /security-analysis for specialized domain knowledge
 */
export function createCodeQualityAnalyzer(filePath: string): AgentDefinition {
  return {
    description: `Analyzes source code files for security vulnerabilities, performance bottlenecks,
and maintainability issues. Use this agent when you need a detailed quality report
with severity-rated issues and an overall score for a given file.`,

    tools: ['Read', 'Grep', 'Glob', 'Skill'],

    prompt: buildCodeQualityAnalyzerPrompt(filePath),

    model: 'inherit',
  };
}
