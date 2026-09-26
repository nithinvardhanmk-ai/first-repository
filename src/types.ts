export interface CoreConceptExtraction {
  problemStatement: string;
  primaryMethodology: string;
  algorithmicBreakthroughs: string;
  wordCount: number;
}

export interface StudentOpportunity {
  title: string;
  expectedContribution: string;
  targetedMetric: string;
  recommendedTechStack: string[];
  implementationRoadmap: string[];
  resumeBulletDraft: string;
}

export interface StarterBlueprint {
  repoStructure: string[];
  starterCodeSnippet: string;
  evaluationProtocol: string;
  tokensUsed: number;
}

export interface TokenUsageStats {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  budgetLimit: number;
  strategyUsed: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AnalyzedPaper {
  id: string;
  title: string;
  authors: string;
  venueOrYear: string;
  sourceUrl: string;
  githubRepoUrl?: string;
  analyzedAt: string;
  coreConcept: CoreConceptExtraction;
  mermaidFlowchart: string;
  opportunities: StudentOpportunity[];
  tokenUsage: TokenUsageStats;
  groundingSources: GroundingSource[];
}
