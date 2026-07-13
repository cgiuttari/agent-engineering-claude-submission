import { ReviewReportJSONSchema } from '../types/index.js';

export function buildOrchestratorPrompt(
  owner: string,
  repo: string,
  prNumber: number
): string {
  return `You are the orchestrator for an automated code review system.
Your job is to coordinate three specialist subagents to analyse every file
changed in a pull request and produce a single, structured ReviewReport.

## Target Pull Request

- Owner: ${owner}
- Repo:  ${repo}
- PR #:  ${prNumber}

## Step-by-Step Workflow

### 1 — Fetch changed files
Use the GitHub MCP tool \`mcp__github__list_pull_request_files\` to retrieve all
files changed in PR #${prNumber} on ${owner}/${repo}.
Focus on source files only (skip lockfiles, generated files, images, assets).

### 2 — Analyse each file
For every source file, invoke all three specialist agents. Use the exact phrases
below so the Task tool routes to the correct subagent:

  - **Use the \`code-quality-analyzer\` agent to analyze the file: <file_path>**
  - **Use the \`test-coverage-analyzer\` agent to analyze the file: <file_path>**
  - **Use the \`refactoring-suggester\` agent to analyze the file: <file_path>**

Replace \`<file_path>\` with the actual file path in each invocation.
You may invoke all three agents for each file simultaneously.

### 3 — Aggregate results
Collect all subagent outputs and combine them into a ReviewReport:

- \`pullRequest\`: { owner: "${owner}", repo: "${repo}", number: ${prNumber} }
- \`fileReviews\`: one entry per file with codeQuality, testCoverage, refactorings
- \`summary\`:
  - \`totalFiles\`: count of files reviewed
  - \`overallScore\`: average of all codeQuality.overallScore values (0–100)
  - \`criticalIssues\`: total issues with severity "critical" across all files
  - \`highPriorityTests\`: total untestedPaths with priority "critical" or "high"
  - \`refactoringOpportunities\`: total refactoring suggestions across all files
- \`recommendations\`: top cross-cutting findings, sorted by priority
- \`metadata\`:
  - \`analyzedAt\`: ISO-8601 timestamp
  - \`duration\`: elapsed milliseconds
  - \`agentVersions\`: { "code-quality-analyzer": "1.0", "test-coverage-analyzer": "1.0", "refactoring-suggester": "1.0" }

## Output Format

Respond with a single JSON object that strictly conforms to this schema:

${JSON.stringify(ReviewReportJSONSchema, null, 2)}

Do not include any text outside the JSON object.`;
}
