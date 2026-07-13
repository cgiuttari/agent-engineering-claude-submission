import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { isReviewError } from './utils/error-handler.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev -- <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // ── 1. Validate command-line arguments ───────────────────────────────────
  if (!owner || !repo || !prStr) {
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    console.error('Example: npm run dev -- facebook react 12345');
    process.exit(1);
  }

  const prNumber = parseInt(prStr, 10);
  if (isNaN(prNumber) || prNumber <= 0 || !Number.isInteger(prNumber)) {
    console.error(`❌ Invalid PR number: "${prStr}" — must be a positive integer.`);
    process.exit(1);
  }

  // ── 2. Validate authentication ────────────────────────────────────────────
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasAwsCreds =
    !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;

  if (hasAwsCreds) {
    if (!process.env.AWS_REGION) {
      console.error('❌ AWS_REGION is required when using AWS Bedrock credentials.');
      console.error('   Set it in your .env file, e.g. AWS_REGION=us-east-1');
      process.exit(1);
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error('❌ No authentication configured. Choose ONE of:');
    console.error('');
    console.error('   Option A — Anthropic API key:');
    console.error('     ANTHROPIC_API_KEY=sk-ant-...');
    console.error('');
    console.error('   Option B — AWS Bedrock:');
    console.error('     AWS_ACCESS_KEY_ID=...');
    console.error('     AWS_SECRET_ACCESS_KEY=...');
    console.error('     AWS_REGION=us-east-1');
    process.exit(1);
  }

  // ── 3. Validate ANTHROPIC_MODEL ───────────────────────────────────────────
  if (!process.env.ANTHROPIC_MODEL) {
    console.error('❌ ANTHROPIC_MODEL environment variable is required.');
    console.error('');
    console.error('   For Anthropic API:  ANTHROPIC_MODEL=claude-sonnet-4-5-20250929');
    console.error('   For AWS Bedrock:    ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0');
    process.exit(1);
  }

  // ── 4. Run the review ─────────────────────────────────────────────────────
  console.log(`\n🔍 Reviewing ${owner}/${repo} PR #${prNumber}…\n`);

  const orchestrator = new CodeReviewOrchestrator();
  let report;

  try {
    report = await orchestrator.reviewPullRequest(owner, repo, prNumber);
  } catch (err) {
    if (isReviewError(err)) {
      console.error(`❌ Review failed [${err.code}]: ${err.message}`);
    } else {
      console.error('❌ Review failed:', err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  }

  // ── 5. Generate and save reports ──────────────────────────────────────────
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const slug = `${owner}-${repo}-pr${prNumber}`;
  const generator = new ReportGenerator();

  const files = {
    markdown: path.join(reportsDir, `${slug}.md`),
    html:     path.join(reportsDir, `${slug}.html`),
    json:     path.join(reportsDir, `${slug}.json`),
  };

  fs.writeFileSync(files.markdown, generator.generateMarkdownReport(report), 'utf8');
  fs.writeFileSync(files.html,     generator.generateHTMLReport(report),     'utf8');
  fs.writeFileSync(files.json,     generator.generateJSONReport(report),     'utf8');

  console.log('\n✅ Review complete!\n');
  console.log(`   📊 Score : ${report.summary.overallScore}/100`);
  console.log(`   🚨 Critical issues        : ${report.summary.criticalIssues}`);
  console.log(`   🧪 High-priority test gaps: ${report.summary.highPriorityTests}`);
  console.log(`   🔧 Refactoring suggestions: ${report.summary.refactoringOpportunities}`);
  console.log('\n   Reports saved:');
  console.log(`     ${files.markdown}`);
  console.log(`     ${files.html}`);
  console.log(`     ${files.json}`);
}

main();
