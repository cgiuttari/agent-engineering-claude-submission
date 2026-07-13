import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { buildTestCoverageAnalyzerPrompt } from '../prompts/test-coverage-analyzer.prompt.js';

/**
 * Test Coverage Analyzer Agent
 *
 * Estimates test completeness by comparing source files with their test
 * counterparts and suggests specific, actionable test cases.
 *
 * Tools:
 *   - Read  : read source and test files to understand implementation and
 *             existing test cases
 *   - Grep  : find function/class declarations in source and locate matching
 *             test blocks (describe/it/test) in test files
 *   - Glob  : discover test files related to the source file under review
 *             (e.g. *.test.ts, *.spec.ts, __tests__/*)
 */
export function createTestCoverageAnalyzer(filePath: string): AgentDefinition {
  return {
    description: `Evaluates test completeness for a source file without running tests.
Identifies untested functions, classes, branches, and edge cases, then suggests
specific actionable test cases with code examples. Use this agent when you need
a coverage estimate and a prioritised list of missing tests for a given file.`,

    tools: ['Read', 'Grep', 'Glob'],

    prompt: buildTestCoverageAnalyzerPrompt(filePath),

    model: 'inherit',
  };
}
