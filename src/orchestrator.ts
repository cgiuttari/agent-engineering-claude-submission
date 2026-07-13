import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReport, ReviewReportSchema, ReviewReportJSONSchema } from './types/index.js';
import {
  createCodeQualityAnalyzer,
  createTestCoverageAnalyzer,
  createRefactoringSuggester,
} from './agents/index.js';
import { mcpServersConfig } from './config/mcp.config.js';
import { logReviewStart, logReviewComplete, logReviewError } from './utils/logger.js';
import { ReviewError, ErrorCodes, withRetry } from './utils/error-handler.js';
import { RateLimiter } from './utils/rate-limiter.js';
import { buildOrchestratorPrompt } from './prompts/orchestrator.prompt.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  /** Claude model identifier. Defaults to ANTHROPIC_MODEL env var. */
  model?: string;
  /**
   * Maximum number of agent turns before the session is aborted.
   * A multi-file PR review (fetch + 3 agents × N files) can easily use 30–60
   * turns, so 100 is a safe upper bound without being unlimited.
   */
  maxTurns?: number;
  /** Rate limiter instance. Defaults to a conservative shared limiter. */
  rateLimiter?: RateLimiter;
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private readonly model: string;
  private readonly maxTurns: number;
  private readonly rateLimiter: RateLimiter;

  constructor(options: OrchestratorOptions = {}) {
    this.model =
      options.model ??
      process.env.ANTHROPIC_MODEL ??
      'claude-sonnet-4-5-20250929';
    this.maxTurns = options.maxTurns ?? 100;
    this.rateLimiter = options.rateLimiter ?? new RateLimiter();
  }

  /**
   * Review a pull request using parallel subagent analysis.
   *
   * Flow:
   *  1. Orchestrator model fetches PR files via GitHub MCP.
   *  2. For each file it spawns code-quality-analyzer, test-coverage-analyzer
   *     and refactoring-suggester subagents via the Task tool.
   *  3. The model aggregates all results and returns a structured ReviewReport.
   *
   * @param owner    - Repository owner (GitHub username or org)
   * @param repo     - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report validated against ReviewReportSchema
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();
    logReviewStart(owner, repo, prNumber);

    let resultMessage: SDKMessage | undefined;

    try {
      // Acquire a rate-limit slot before starting the orchestrator query.
      // This prevents stacking multiple concurrent PR reviews against the API.
      await this.rateLimiter.acquire();

      // query() returns an AsyncGenerator (Query), not a Promise, so we can't
      // pass it directly to withRetry. Instead we wrap the full iteration in an
      // async function that resolves to the final SDKMessage — that Promise is
      // what withRetry retries on transient failures.
      const runQuery = async (): Promise<SDKMessage> => {
        const queryResult = query({
          prompt: buildOrchestratorPrompt(owner, repo, prNumber),
          options: {
            model: this.model,
            maxTurns: this.maxTurns,
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            allowedTools: ['Task', 'mcp__github__*', 'mcp__eslint__*'],
            agents: {
              'code-quality-analyzer': createCodeQualityAnalyzer('<file>'),
              'test-coverage-analyzer': createTestCoverageAnalyzer('<file>'),
              'refactoring-suggester': createRefactoringSuggester('<file>'),
            },
            mcpServers: {
              github: mcpServersConfig.github,
              eslint: mcpServersConfig.eslint,
            },
            outputFormat: {
              type: 'json_schema',
              schema: ReviewReportJSONSchema,
            },
          },
        });

        for await (const message of queryResult) {
          if (message.type === 'result') {
            return message;
          }
        }

        throw new ReviewError(
          'No result message received from orchestrator query',
          ErrorCodes.AGENT_FAILED,
          { owner, repo, prNumber }
        );
      };

      resultMessage = await withRetry(runQuery, 3, 2000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logReviewError(owner, repo, prNumber, error);
      throw new ReviewError(
        `Orchestrator query failed: ${error.message}`,
        ErrorCodes.AGENT_FAILED,
        { owner, repo, prNumber }
      );
    } finally {
      this.rateLimiter.release();
    }

    // Guard: the session must have ended successfully.
    if (resultMessage.type !== 'result' || resultMessage.subtype !== 'success') {
      const subtype = resultMessage.type === 'result' ? resultMessage.subtype : resultMessage.type;
      throw new ReviewError(
        `Orchestrator session ended with error subtype: ${subtype}`,
        ErrorCodes.AGENT_FAILED,
        { owner, repo, prNumber }
      );
    }

    // Validate the structured output against the Zod schema.
    // safeParse is preferred over parse so we can throw a typed ReviewError.
    const parsed = ReviewReportSchema.safeParse(resultMessage.structured_output);
    if (!parsed.success) {
      throw new ReviewError(
        `Structured output failed schema validation: ${parsed.error.message}`,
        ErrorCodes.VALIDATION_FAILED,
        { owner, repo, prNumber, zodError: parsed.error.flatten() }
      );
    }

    const duration = Date.now() - startTime;
    logReviewComplete(owner, repo, prNumber, parsed.data.summary.overallScore, duration);

    return parsed.data;
  }
}
