import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionJSONSchema,
} from '../src/types/analysis-results.js';
import {
  ReviewReportSchema,
  ReviewReportJSONSchema,
} from '../src/types/report-types.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const validCodeQuality = {
  file: 'src/auth.ts',
  issues: [
    {
      line: 12,
      severity: 'high' as const,
      category: 'security' as const,
      description: 'User input not sanitised',
      suggestion: 'Use a validation library',
    },
  ],
  overallScore: 75,
  summary: 'Decent code with one security concern.',
};

const validTestCoverage = {
  file: 'src/auth.ts',
  hasTests: true,
  testFiles: ['tests/auth.test.ts'],
  untestedPaths: [
    {
      type: 'function' as const,
      location: 'line 42: function login()',
      priority: 'high' as const,
      reasoning: 'Main auth path has no test',
      suggestedTest: "it('should reject invalid credentials', () => { ... })",
    },
  ],
  coverageEstimate: 60,
  summary: 'Core paths covered; edge cases missing.',
};

const validRefactoring = {
  file: 'src/auth.ts',
  suggestions: [
    {
      type: 'modernize' as const,
      location: 'line 5',
      impact: 'medium' as const,
      description: 'Replace .then() with async/await',
      before: 'return fetch(url).then(r => r.json())',
      after: 'return await (await fetch(url)).json()',
      benefits: 'Improves readability and error handling.',
    },
  ],
  summary: 'One modernisation opportunity found.',
};

const validReviewReport = {
  pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
  fileReviews: [
    {
      file: 'src/auth.ts',
      codeQuality: validCodeQuality,
      testCoverage: validTestCoverage,
      refactorings: validRefactoring,
    },
  ],
  summary: {
    totalFiles: 1,
    overallScore: 75,
    criticalIssues: 0,
    highPriorityTests: 1,
    refactoringOpportunities: 1,
  },
  recommendations: [
    {
      priority: 'high' as const,
      category: 'Security',
      description: 'Sanitise user input',
      files: ['src/auth.ts'],
    },
  ],
  metadata: {
    analyzedAt: '2026-07-09T12:00:00.000Z',
    duration: 5000,
    agentVersions: { 'code-quality-analyzer': '1.0' },
  },
};

// ─── CodeQualityResultSchema ──────────────────────────────────────────────────

describe('CodeQualityResultSchema', () => {
  describe('valid data', () => {
    it('parses a complete valid object', () => {
      expect(() => CodeQualityResultSchema.parse(validCodeQuality)).not.toThrow();
    });

    it('parses with an empty issues array', () => {
      expect(() =>
        CodeQualityResultSchema.parse({ ...validCodeQuality, issues: [] })
      ).not.toThrow();
    });

    it('accepts boundary score of 0', () => {
      const result = CodeQualityResultSchema.parse({ ...validCodeQuality, overallScore: 0 });
      expect(result.overallScore).toBe(0);
    });

    it('accepts boundary score of 100', () => {
      const result = CodeQualityResultSchema.parse({ ...validCodeQuality, overallScore: 100 });
      expect(result.overallScore).toBe(100);
    });

    it('accepts all severity values', () => {
      const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
      for (const severity of severities) {
        const data = {
          ...validCodeQuality,
          issues: [{ ...validCodeQuality.issues[0]!, severity }],
        };
        expect(() => CodeQualityResultSchema.parse(data)).not.toThrow();
      }
    });

    it('accepts all category values', () => {
      const categories = [
        'security', 'performance', 'maintainability',
        'style', 'bug-risk', 'best-practice',
      ] as const;
      for (const category of categories) {
        const data = {
          ...validCodeQuality,
          issues: [{ ...validCodeQuality.issues[0]!, category }],
        };
        expect(() => CodeQualityResultSchema.parse(data)).not.toThrow();
      }
    });
  });

  describe('invalid data', () => {
    it('throws when file is missing', () => {
      const { file: _f, ...rest } = validCodeQuality;
      expect(() => CodeQualityResultSchema.parse(rest)).toThrow(ZodError);
    });

    it('throws when overallScore is below 0', () => {
      expect(() =>
        CodeQualityResultSchema.parse({ ...validCodeQuality, overallScore: -1 })
      ).toThrow(ZodError);
    });

    it('throws when overallScore exceeds 100', () => {
      expect(() =>
        CodeQualityResultSchema.parse({ ...validCodeQuality, overallScore: 101 })
      ).toThrow(ZodError);
    });

    it('throws when severity is an unknown value', () => {
      const data = {
        ...validCodeQuality,
        issues: [{ ...validCodeQuality.issues[0]!, severity: 'catastrophic' }],
      };
      expect(() => CodeQualityResultSchema.parse(data)).toThrow(ZodError);
    });

    it('throws when category is an unknown value', () => {
      const data = {
        ...validCodeQuality,
        issues: [{ ...validCodeQuality.issues[0]!, category: 'unknown' }],
      };
      expect(() => CodeQualityResultSchema.parse(data)).toThrow(ZodError);
    });

    it('throws when an issue is missing a required field', () => {
      const data = {
        ...validCodeQuality,
        issues: [{ line: 1, severity: 'low' }], // missing category, description, suggestion
      };
      expect(() => CodeQualityResultSchema.parse(data)).toThrow(ZodError);
    });
  });
});

// ─── TestCoverageResultSchema ─────────────────────────────────────────────────

describe('TestCoverageResultSchema', () => {
  describe('valid data', () => {
    it('parses a complete valid object', () => {
      expect(() => TestCoverageResultSchema.parse(validTestCoverage)).not.toThrow();
    });

    it('parses when hasTests is false with empty arrays', () => {
      expect(() =>
        TestCoverageResultSchema.parse({
          ...validTestCoverage,
          hasTests: false,
          testFiles: [],
          untestedPaths: [],
          coverageEstimate: 0,
        })
      ).not.toThrow();
    });

    it('accepts boundary coverageEstimate of 0', () => {
      const r = TestCoverageResultSchema.parse({ ...validTestCoverage, coverageEstimate: 0 });
      expect(r.coverageEstimate).toBe(0);
    });

    it('accepts boundary coverageEstimate of 100', () => {
      const r = TestCoverageResultSchema.parse({ ...validTestCoverage, coverageEstimate: 100 });
      expect(r.coverageEstimate).toBe(100);
    });

    it('accepts all untestedPath type values', () => {
      const types = ['function', 'class', 'branch', 'edge-case'] as const;
      for (const type of types) {
        const data = {
          ...validTestCoverage,
          untestedPaths: [{ ...validTestCoverage.untestedPaths[0]!, type }],
        };
        expect(() => TestCoverageResultSchema.parse(data)).not.toThrow();
      }
    });

    it('accepts all priority values', () => {
      const priorities = ['critical', 'high', 'medium', 'low'] as const;
      for (const priority of priorities) {
        const data = {
          ...validTestCoverage,
          untestedPaths: [{ ...validTestCoverage.untestedPaths[0]!, priority }],
        };
        expect(() => TestCoverageResultSchema.parse(data)).not.toThrow();
      }
    });
  });

  describe('invalid data', () => {
    it('throws when hasTests is not a boolean', () => {
      expect(() =>
        TestCoverageResultSchema.parse({ ...validTestCoverage, hasTests: 'yes' })
      ).toThrow(ZodError);
    });

    it('throws when coverageEstimate exceeds 100', () => {
      expect(() =>
        TestCoverageResultSchema.parse({ ...validTestCoverage, coverageEstimate: 101 })
      ).toThrow(ZodError);
    });

    it('throws when untestedPath type is invalid', () => {
      const data = {
        ...validTestCoverage,
        untestedPaths: [{ ...validTestCoverage.untestedPaths[0]!, type: 'method' }],
      };
      expect(() => TestCoverageResultSchema.parse(data)).toThrow(ZodError);
    });

    it('throws when untestedPath priority is invalid', () => {
      const data = {
        ...validTestCoverage,
        untestedPaths: [{ ...validTestCoverage.untestedPaths[0]!, priority: 'urgent' }],
      };
      expect(() => TestCoverageResultSchema.parse(data)).toThrow(ZodError);
    });

    it('throws when file is missing', () => {
      const { file: _f, ...rest } = validTestCoverage;
      expect(() => TestCoverageResultSchema.parse(rest)).toThrow(ZodError);
    });
  });
});

// ─── RefactoringSuggestionSchema ──────────────────────────────────────────────

describe('RefactoringSuggestionSchema', () => {
  describe('valid data', () => {
    it('parses a complete valid object', () => {
      expect(() => RefactoringSuggestionSchema.parse(validRefactoring)).not.toThrow();
    });

    it('parses with an empty suggestions array', () => {
      expect(() =>
        RefactoringSuggestionSchema.parse({ ...validRefactoring, suggestions: [] })
      ).not.toThrow();
    });

    it('accepts all suggestion type values', () => {
      const types = [
        'extract-function', 'rename', 'modernize', 'simplify', 'pattern-improvement',
      ] as const;
      for (const type of types) {
        const data = {
          ...validRefactoring,
          suggestions: [{ ...validRefactoring.suggestions[0]!, type }],
        };
        expect(() => RefactoringSuggestionSchema.parse(data)).not.toThrow();
      }
    });

    it('accepts all impact values', () => {
      const impacts = ['low', 'medium', 'high'] as const;
      for (const impact of impacts) {
        const data = {
          ...validRefactoring,
          suggestions: [{ ...validRefactoring.suggestions[0]!, impact }],
        };
        expect(() => RefactoringSuggestionSchema.parse(data)).not.toThrow();
      }
    });
  });

  describe('invalid data', () => {
    it('throws when suggestion type is invalid', () => {
      const data = {
        ...validRefactoring,
        suggestions: [{ ...validRefactoring.suggestions[0]!, type: 'delete' }],
      };
      expect(() => RefactoringSuggestionSchema.parse(data)).toThrow(ZodError);
    });

    it('throws when impact is invalid', () => {
      const data = {
        ...validRefactoring,
        suggestions: [{ ...validRefactoring.suggestions[0]!, impact: 'critical' }],
      };
      expect(() => RefactoringSuggestionSchema.parse(data)).toThrow(ZodError);
    });

    it('throws when a suggestion is missing before/after', () => {
      const { before: _b, after: _a, ...noSnippets } = validRefactoring.suggestions[0]!;
      expect(() =>
        RefactoringSuggestionSchema.parse({ ...validRefactoring, suggestions: [noSnippets] })
      ).toThrow(ZodError);
    });

    it('throws when file is missing', () => {
      const { file: _f, ...rest } = validRefactoring;
      expect(() => RefactoringSuggestionSchema.parse(rest)).toThrow(ZodError);
    });
  });
});

// ─── ReviewReportSchema ───────────────────────────────────────────────────────

describe('ReviewReportSchema', () => {
  describe('valid data', () => {
    it('parses a complete valid report', () => {
      expect(() => ReviewReportSchema.parse(validReviewReport)).not.toThrow();
    });

    it('parses with empty fileReviews and recommendations', () => {
      expect(() =>
        ReviewReportSchema.parse({
          ...validReviewReport,
          fileReviews: [],
          recommendations: [],
          summary: { ...validReviewReport.summary, totalFiles: 0 },
        })
      ).not.toThrow();
    });

    it('accepts all recommendation priority values', () => {
      const priorities = ['critical', 'high', 'medium', 'low'] as const;
      for (const priority of priorities) {
        const data = {
          ...validReviewReport,
          recommendations: [{ ...validReviewReport.recommendations[0]!, priority }],
        };
        expect(() => ReviewReportSchema.parse(data)).not.toThrow();
      }
    });
  });

  describe('invalid data', () => {
    it('throws when pullRequest fields are missing', () => {
      const data = { ...validReviewReport, pullRequest: { owner: 'x' } };
      expect(() => ReviewReportSchema.parse(data)).toThrow(ZodError);
    });

    it('throws when recommendation priority is invalid', () => {
      const data = {
        ...validReviewReport,
        recommendations: [{ ...validReviewReport.recommendations[0]!, priority: 'urgent' }],
      };
      expect(() => ReviewReportSchema.parse(data)).toThrow(ZodError);
    });

    it('throws when metadata is missing', () => {
      const { metadata: _m, ...rest } = validReviewReport;
      expect(() => ReviewReportSchema.parse(rest)).toThrow(ZodError);
    });

    it('throws when summary scores are not numbers', () => {
      const data = {
        ...validReviewReport,
        summary: { ...validReviewReport.summary, overallScore: 'good' },
      };
      expect(() => ReviewReportSchema.parse(data)).toThrow(ZodError);
    });
  });
});

// ─── JSON Schema exports ──────────────────────────────────────────────────────

describe('JSON Schema exports', () => {
  it('CodeQualityResultJSONSchema is a valid JSON schema object', () => {
    expect(CodeQualityResultJSONSchema).toBeTypeOf('object');
    expect(CodeQualityResultJSONSchema).not.toBeNull();
  });

  it('CodeQualityResultJSONSchema marks required properties', () => {
    const schema = CodeQualityResultJSONSchema as Record<string, unknown>;
    expect(schema['required']).toBeDefined();
    expect(Array.isArray(schema['required'])).toBe(true);
    expect(schema['required']).toContain('file');
    expect(schema['required']).toContain('overallScore');
  });

  it('TestCoverageResultJSONSchema is a valid JSON schema object', () => {
    expect(TestCoverageResultJSONSchema).toBeTypeOf('object');
    const schema = TestCoverageResultJSONSchema as Record<string, unknown>;
    expect(schema['required']).toContain('file');
    expect(schema['required']).toContain('hasTests');
    expect(schema['required']).toContain('coverageEstimate');
  });

  it('RefactoringSuggestionJSONSchema is a valid JSON schema object', () => {
    expect(RefactoringSuggestionJSONSchema).toBeTypeOf('object');
    const schema = RefactoringSuggestionJSONSchema as Record<string, unknown>;
    expect(schema['required']).toContain('file');
    expect(schema['required']).toContain('suggestions');
  });

  it('ReviewReportJSONSchema is a valid JSON schema object', () => {
    expect(ReviewReportJSONSchema).toBeTypeOf('object');
    const schema = ReviewReportJSONSchema as Record<string, unknown>;
    expect(schema['required']).toContain('pullRequest');
    expect(schema['required']).toContain('fileReviews');
    expect(schema['required']).toContain('summary');
    expect(schema['required']).toContain('metadata');
  });

  it('JSON schemas are serialisable (no circular references)', () => {
    expect(() => JSON.stringify(CodeQualityResultJSONSchema)).not.toThrow();
    expect(() => JSON.stringify(TestCoverageResultJSONSchema)).not.toThrow();
    expect(() => JSON.stringify(RefactoringSuggestionJSONSchema)).not.toThrow();
    expect(() => JSON.stringify(ReviewReportJSONSchema)).not.toThrow();
  });
});
