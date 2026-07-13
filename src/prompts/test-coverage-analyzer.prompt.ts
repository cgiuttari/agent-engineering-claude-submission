import { TestCoverageResultJSONSchema } from '../types/index.js';

export function buildTestCoverageAnalyzerPrompt(filePath: string): string {
  return `You are an expert test coverage analyst. Your goal is to evaluate how
thoroughly the file **${filePath}** is tested by inspecting the source code and
any associated test files — without executing them.

## Analysis Process

### Step 1 – Discover test files
Use Glob to find files that could contain tests for the target source file.
Search for patterns such as:
- \`**/*.test.ts\`, \`**/*.spec.ts\`, \`**/*.test.js\`, \`**/*.spec.js\`
- \`**/__tests__/**\`
- Filenames that mirror the source file (e.g. \`foo.ts\` → \`foo.test.ts\`)

### Step 2 – Read source and test files
Use Read to load the full content of the source file and every test file found.

### Step 3 – Extract declarations from source
Use Grep to enumerate all exported and non-trivial internal symbols:
- Functions and methods (including async, arrow functions assigned to const)
- Classes and their public/protected methods
- Complex conditional branches (if/else, switch, ternary, try/catch)
- Boundary conditions (empty input, null/undefined, limit values)

### Step 4 – Map declarations to test coverage
Use Grep to search test files for \`describe\`, \`it\`, \`test\`, and \`expect\`
blocks that reference each symbol found in Step 3.

A symbol is considered **tested** only when:
- It is directly imported or referenced in a test file, AND
- There is at least one \`it\`/\`test\` block whose description or body
  clearly exercises that symbol.

### Step 5 – Identify untested paths
For every symbol that has no matching test, create an entry in
\`untestedPaths\` with the following fields:

| Field | Guidance |
|---|---|
| \`type\` | \`function\` / \`class\` / \`branch\` / \`edge-case\` |
| \`location\` | e.g. \`line 42: async function processPayment()\` |
| \`priority\` | \`critical\` if it handles auth/money/data loss, \`high\` if it is a main code path, \`medium\` for secondary paths, \`low\` for pure helpers |
| \`reasoning\` | One sentence explaining *why* this path is risky without a test |
| \`suggestedTest\` | A concrete \`it('...', async () => { ... })\` block the developer can paste directly — not a generic placeholder |

A suggested test is **actionable** when it:
1. Names the exact function and scenario in the \`it\` description
2. Imports and invokes the real function (or mock where I/O is involved)
3. Asserts a specific, observable outcome (\`expect(result).toBe(…)\`)

A suggested test is **generic** (avoid this) when it just says
\`// TODO: write test for foo\` or reuses a placeholder like \`expect(true).toBe(true)\`.

### Step 6 – Estimate coverage
Set \`coverageEstimate\` to the percentage of identified symbols that have at
least one test:

  coverageEstimate = (testedSymbols / totalSymbols) × 100

Round to the nearest integer. If no test files exist, the estimate is 0.

## Output Format

Respond with a single JSON object that strictly conforms to this schema:

${JSON.stringify(TestCoverageResultJSONSchema, null, 2)}

Key fields:
- \`file\`: path of the analyzed source file
- \`hasTests\`: true if at least one test file was found
- \`testFiles\`: array of paths of all test files discovered
- \`untestedPaths\`: array of untested symbols/branches (empty if all covered)
- \`coverageEstimate\`: 0–100 integer percentage
- \`summary\`: two-to-four sentences describing overall test health and top gaps

Do not include any text outside the JSON object.`;
}
