/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { PRESET_PAPERS } from './data/presetPapers';
import { AnalyzedPaper, StarterBlueprint, StudentOpportunity } from './types';
import { MermaidDiagram } from './components/MermaidDiagram';

const STORAGE_KEY = 'paperforge_analyzed_papers_v1';
const TOKEN_BUDGET_CAP = 25000;

const QUICK_SAMPLE_QUERIES = [
  {
    label: 'Attention Is All You Need (arXiv:1706.03762)',
    url: 'https://arxiv.org/abs/1706.03762',
  },
  {
    label: 'DeepSeek-R1: Incentivizing Reasoning (arXiv:2501.12948)',
    url: 'https://arxiv.org/abs/2501.12948',
  },
  {
    label: '3D Gaussian Splatting (arXiv:2308.04079)',
    url: 'https://arxiv.org/abs/2308.04079',
  },
];

export default function App() {
  const [papers, setPapers] = useState<AnalyzedPaper[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return PRESET_PAPERS;
  });

  const [selectedPaperId, setSelectedPaperId] = useState<string>(() => papers[0]?.id || '');
  const [paperInputUrl, setPaperInputUrl] = useState<string>('');
  const [archiveSearch, setArchiveSearch] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [conceptViewMode, setConceptViewMode] = useState<'structured' | 'unified'>('structured');
  const [copiedFullReport, setCopiedFullReport] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [copiedBulletIdx, setCopiedBulletIdx] = useState<number | null>(null);

  // Blueprint generation state per opportunity key (`${paperId}-${oppIndex}`)
  const [blueprints, setBlueprints] = useState<Record<string, StarterBlueprint>>({});
  const [loadingBlueprintKey, setLoadingBlueprintKey] = useState<string | null>(null);
  const [blueprintError, setBlueprintError] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
    } catch {
      // Ignore storage quota errors
    }
  }, [papers]);

  const activePaper = useMemo(
    () => papers.find((p) => p.id === selectedPaperId) || papers[0],
    [papers, selectedPaperId]
  );

  const filteredPapers = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    if (!q) return papers;
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.venueOrYear.toLowerCase().includes(q) ||
        p.sourceUrl.toLowerCase().includes(q)
    );
  }, [papers, archiveSearch]);

  const buildFormattedPlainReport = (paper: AnalyzedPaper): string => {
    const cleanMermaid = paper.mermaidFlowchart
      .replace(/```mermaid/gi, '')
      .replace(/```/g, '')
      .replace(/^\[FLOWCHART\]\s*/i, '')
      .trim();

    const oppsText = paper.opportunities
      .map(
        (opp, idx) =>
          `${idx + 1}. ${opp.title}
- Expected Contribution: ${opp.expectedContribution}
- Targeted Performance Metric: ${opp.targetedMetric}
- Recommended Tech Stack: ${opp.recommendedTechStack.join(', ')}
- Resume Draft: ${opp.resumeBulletDraft}`
      )
      .join('\n\n');

    return `# ${paper.title}
Authors: ${paper.authors} · ${paper.venueOrYear}
Source: ${paper.sourceUrl}${paper.githubRepoUrl ? `\nGitHub: ${paper.githubRepoUrl}` : ''}
Token Usage: ${paper.tokenUsage.totalTokens.toLocaleString()} / ${TOKEN_BUDGET_CAP.toLocaleString()} tokens (${paper.tokenUsage.strategyUsed})

## 1. CORE CONCEPT EXTRACTION (${paper.coreConcept.wordCount} / 300 words)

Problem Statement:
${paper.coreConcept.problemStatement}

Primary Methodology:
${paper.coreConcept.primaryMethodology}

Key Mathematical & Algorithmic Breakthroughs:
${paper.coreConcept.algorithmicBreakthroughs}

## 2. ARCHITECTURAL FLOWCHART (Mermaid.js)

[FLOWCHART]
${cleanMermaid}

## 3. FUTURE WORK & INTERNSHIP OPPORTUNITIES

${oppsText}
`;
  };

  const handleAnalyzePaper = async (overrideInput?: string) => {
    const targetInput = (overrideInput ?? paperInputUrl).trim();
    if (!targetInput) {
      setAnalysisError('Enter a research paper URL (e.g., arXiv link) or paper title to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/analyze-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperUrlOrQuery: targetInput }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse research paper.');
      }

      const newPaper: AnalyzedPaper = data;
      setPapers((prev) => [newPaper, ...prev]);
      setSelectedPaperId(newPaper.id);
      if (!overrideInput) {
        setPaperInputUrl('');
      }
    } catch (err: any) {
      setAnalysisError(
        err instanceof Error ? err.message : 'An unexpected error occurred during paper analysis.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateBlueprint = async (paper: AnalyzedPaper, opp: StudentOpportunity, idx: number) => {
    const key = `${paper.id}-${idx}`;
    if (blueprints[key]) return;

    setLoadingBlueprintKey(key);
    setBlueprintError((prev) => ({ ...prev, [key]: '' }));

    try {
      const response = await fetch('/api/generate-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperTitle: paper.title,
          opportunity: opp,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not generate starter blueprint.');
      }
      setBlueprints((prev) => ({ ...prev, [key]: data }));
    } catch (err: any) {
      setBlueprintError((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : 'Failed to generate blueprint.',
      }));
    } finally {
      setLoadingBlueprintKey(null);
    }
  };

  const handleCopyFullReport = async () => {
    if (!activePaper) return;
    try {
      await navigator.clipboard.writeText(buildFormattedPlainReport(activePaper));
      setCopiedFullReport(true);
      setTimeout(() => setCopiedFullReport(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleExportMarkdown = () => {
    if (!activePaper) return;
    const content = buildFormattedPlainReport(activePaper);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = activePaper.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    link.href = url;
    link.download = `${slug || 'research-brief'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCoreConcept = async () => {
    if (!activePaper) return;
    const text = `${activePaper.coreConcept.problemStatement}\n\n${activePaper.coreConcept.primaryMethodology}\n\n${activePaper.coreConcept.algorithmicBreakthroughs}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleCopyResumeBullet = async (bullet: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(bullet);
      setCopiedBulletIdx(idx);
      setTimeout(() => setCopiedBulletIdx(null), 2000);
    } catch {
      // Ignore
    }
  };

  const handleDeletePaper = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (papers.length <= 1) return;
    const next = papers.filter((p) => p.id !== id);
    setPapers(next);
    if (selectedPaperId === id) {
      setSelectedPaperId(next[0].id);
    }
  };

  const scrollToSection = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const activeTokenPercent = activePaper
    ? Math.min(100, Math.round((activePaper.tokenUsage.totalTokens / TOKEN_BUDGET_CAP) * 100))
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200">
        {/* Zone 1: Brand Title (Single text element in display face) */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-xl font-semibold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          PaperForge
        </a>

        {/* Zone 2: 4 Clean Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => scrollToSection('parser-bar')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Parser Input
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-core-concept')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Core Concept
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-flowchart')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Flowchart
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-opportunities')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Student Opportunities
          </button>
        </nav>

        {/* Zone 3: 2 Primary Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyFullReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            {copiedFullReport ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedFullReport ? 'Copied Brief' : 'Copy Brief'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Markdown</span>
          </button>
        </div>
      </header>

      {/* Main 1440px Desktop Workspace Layout: Sidebar + Main Content */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12">
        {/* Left Sidebar: Analyzed Paper Archive & Token Efficiency Ledger */}
        <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-5 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900">Analyzed Paper Library</h2>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {papers.length} papers
                </span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="Filter by title, author, arXiv..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1E40AF]"
                />
              </div>
            </div>

            {/* Paper List */}
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {filteredPapers.length === 0 ? (
                <div className="py-8 px-3 text-center border border-dashed border-slate-200 rounded-md">
                  <p className="text-xs text-slate-500 mb-2">
                    No analyzed papers match "{archiveSearch}".
                  </p>
                  <button
                    type="button"
                    onClick={() => setArchiveSearch('')}
                    className="text-xs font-semibold text-[#1E40AF] hover:underline"
                  >
                    Clear search filter
                  </button>
                </div>
              ) : (
                filteredPapers.map((paper) => {
                  const isSelected = paper.id === activePaper?.id;
                  return (
                    <div
                      key={paper.id}
                      onClick={() => setSelectedPaperId(paper.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedPaperId(paper.id);
                        }
                      }}
                      className={`group w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/60 border-[#1E40AF]/40 text-slate-900'
                          : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold leading-snug line-clamp-2 text-slate-900">
                          {paper.title}
                        </p>
                        {papers.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleDeletePaper(paper.id, e)}
                            title="Remove from library"
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {/* Clean unboxed metadata with middle-dot separators */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="truncate max-w-[125px]">{paper.authors.split(',')[0]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {paper.coreConcept.wordCount}w
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {paper.tokenUsage.totalTokens.toLocaleString()} tok
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Operational Constraint & Token Budget Monitor */}
          {activePaper && (
            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">Token Efficiency Budget</span>
                <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                  {activePaper.tokenUsage.totalTokens.toLocaleString()} /{' '}
                  {TOKEN_BUDGET_CAP.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1E40AF] transition-all duration-200"
                  style={{ width: `${Math.max(4, activeTokenPercent)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Strategy: {activePaper.tokenUsage.strategyUsed}. Avoids raw full-PDF token bloat by
                combining abstract extraction, web grounding, and GitHub architecture lookup.
              </p>
            </div>
          )}
        </aside>

        {/* Main Content Viewport */}
        <main className="lg:col-span-9 p-6 md:p-8 lg:p-10 space-y-10">
          {/* Paper URL / Title Parser Input Bar */}
          <section
            id="parser-bar"
            className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 font-display">
                  Computer Science Research Paper Parser
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                  Paste an arXiv URL, PDF link, OpenReview link, or paper title to extract a
                  &lt;300-word core concept synthesis, an architectural Mermaid.js{' '}
                  <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                    graph TD
                  </code>{' '}
                  flowchart, and 3 concrete 3rd-year CS student project extensions under a strict
                  25,000-token ceiling.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAnalyzePaper();
              }}
              className="flex flex-col sm:flex-row gap-3 pt-1"
            >
              <input
                type="text"
                value={paperInputUrl}
                onChange={(e) => setPaperInputUrl(e.target.value)}
                disabled={isAnalyzing}
                placeholder="Paste research paper URL (e.g., https://arxiv.org/abs/1706.03762) or paper title..."
                className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#1E40AF]"
              />
              <button
                type="submit"
                disabled={isAnalyzing}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-blue-900 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isAnalyzing ? 'Parsing Paper & Grounding...' : 'Analyze Research Paper'}
              </button>
            </form>

            {/* Quick-load sample research URLs */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 pt-1">
              <span className="font-medium text-slate-700">Try live URL extraction:</span>
              {QUICK_SAMPLE_QUERIES.map((sample, i) => (
                <React.Fragment key={sample.url}>
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => {
                      setPaperInputUrl(sample.url);
                      handleAnalyzePaper(sample.url);
                    }}
                    className="text-[#1E40AF] hover:underline font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {sample.label}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {analysisError && (
              <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-4">
                <span>Error: {analysisError}</span>
                <button
                  type="button"
                  onClick={() => setAnalysisError(null)}
                  className="font-semibold underline whitespace-nowrap shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}
          </section>

          {/* Pending Skeleton State during Live Analysis */}
          {isAnalyzing && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 animate-pulse">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-7 w-3/4 bg-slate-200 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="h-28 bg-slate-100 rounded-md" />
                <div className="h-28 bg-slate-100 rounded-md" />
                <div className="h-28 bg-slate-100 rounded-md" />
              </div>
            </div>
          )}

          {/* Active Paper Analysis Workspace */}
          {activePaper && (
            <div className="space-y-10">
              {/* Active Paper Metadata Header (Unboxed Metadata with Typographic Separators) */}
              <div className="border-b border-slate-200 pb-6 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{activePaper.venueOrYear}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activePaper.authors}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-emerald-700 font-medium">
                    {activePaper.coreConcept.wordCount} / 300 words
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {activePaper.tokenUsage.totalTokens.toLocaleString()} / 25,000 tokens
                  </span>
                </div>

                <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 font-display">
                  {activePaper.title}
                </h2>

                <div className="flex flex-wrap items-center gap-5 pt-1 text-xs">
                  <a
                    href={activePaper.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#1E40AF] hover:underline"
                  >
                    <span>Paper Source ({activePaper.sourceUrl})</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {activePaper.githubRepoUrl && (
                    <a
                      href={activePaper.githubRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      <span>Open-Source Implementation ({activePaper.githubRepoUrl})</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {activePaper.groundingSources && activePaper.groundingSources.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Grounded References:</span>
                    {activePaper.groundingSources.map((src, idx) => (
                      <React.Fragment key={`${src.uri}-${idx}`}>
                        {idx > 0 && <span aria-hidden="true">·</span>}
                        <a
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-slate-900 underline decoration-slate-300 underline-offset-2 truncate max-w-xs"
                        >
                          {src.title}
                        </a>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* STEP 1: CORE CONCEPT EXTRACTION */}
              <section id="section-core-concept" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      01. Core Concept Extraction
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Plain-language synthesis of the problem statement, primary methodology, and
                      mathematical breakthroughs in strictly under 300 words (
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {activePaper.coreConcept.wordCount} words
                      </span>
                      ).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-md">
                      <button
                        type="button"
                        onClick={() => setConceptViewMode('structured')}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          conceptViewMode === 'structured'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        3-Part Breakdown
                      </button>
                      <button
                        type="button"
                        onClick={() => setConceptViewMode('unified')}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          conceptViewMode === 'unified'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Unified Narrative
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyCoreConcept}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedSummary ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                    </button>
                  </div>
                </div>

                {conceptViewMode === 'structured' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 border border-slate-200 rounded-lg bg-white divide-y md:divide-y-0 md:divide-x divide-slate-200">
                    <div className="p-5 space-y-2">
                      <div className="text-xs font-semibold text-slate-900">
                        Problem Statement & Bottleneck
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {activePaper.coreConcept.problemStatement}
                      </p>
                    </div>

                    <div className="p-5 space-y-2">
                      <div className="text-xs font-semibold text-slate-900">
                        Primary Methodology Introduced
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {activePaper.coreConcept.primaryMethodology}
                      </p>
                    </div>

                    <div className="p-5 space-y-2">
                      <div className="text-xs font-semibold text-slate-900">
                        Mathematical & Algorithmic Breakthroughs
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {activePaper.coreConcept.algorithmicBreakthroughs}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
                    <p className="text-base text-slate-800 leading-relaxed max-w-[72ch]">
                      {activePaper.coreConcept.problemStatement}{' '}
                      {activePaper.coreConcept.primaryMethodology}{' '}
                      {activePaper.coreConcept.algorithmicBreakthroughs}
                    </p>
                  </div>
                )}
              </section>

              {/* STEP 2: ARCHITECTURAL FLOWCHART (Mermaid.js) */}
              <section id="section-flowchart" className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    02. Architectural Flowchart (Mermaid.js)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    End-to-end data flow from input tensors through model layers to outputs,
                    rendered as an interactive SVG alongside the unboxed{' '}
                    <code className="font-mono text-slate-700">[FLOWCHART]</code> text segment.
                  </p>
                </div>

                <MermaidDiagram
                  chart={activePaper.mermaidFlowchart}
                  paperTitle={activePaper.title}
                />
              </section>

              {/* STEP 3: FUTURE WORK & INTERNSHIP OPPORTUNITIES */}
              <section id="section-opportunities" className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    03. Future Work & Internship Opportunities (3rd-Year CS Student Projects)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Three concrete, high-signal extensions tailored for an undergraduate CS student
                    portfolio, specifying expected architectural contribution, targeted performance
                    metric, and recommended tech stack.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg bg-white divide-y divide-slate-200">
                  {activePaper.opportunities.map((opp, idx) => {
                    const bpKey = `${activePaper.id}-${idx}`;
                    const blueprint = blueprints[bpKey];
                    const isGeneratingBp = loadingBlueprintKey === bpKey;
                    const bpErr = blueprintError[bpKey];

                    return (
                      <div key={`${activePaper.id}-opp-${idx}`} className="p-6 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500 font-mono tabular-nums">
                              Project Extension 0{idx + 1} · Recommended Stack:{' '}
                              <span className="text-slate-800 font-medium">
                                {opp.recommendedTechStack.join(' · ')}
                              </span>
                            </div>
                            <h4 className="text-base font-semibold text-slate-900">{opp.title}</h4>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyResumeBullet(opp.resumeBulletDraft, idx)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {copiedBulletIdx === idx ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {copiedBulletIdx === idx ? 'Copied Resume Bullet' : 'Copy Resume Line'}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={isGeneratingBp}
                              onClick={() => handleGenerateBlueprint(activePaper, opp, idx)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E40AF] bg-blue-50/80 border border-blue-200 rounded-md hover:bg-blue-100/70 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                              <span>
                                {blueprint
                                  ? 'Starter Blueprint Ready'
                                  : isGeneratingBp
                                  ? 'Synthesizing Blueprint...'
                                  : 'Generate Starter Code'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Expected Contribution & Targeted Metric */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-1">
                          <div className="md:col-span-7 space-y-1">
                            <div className="text-xs font-semibold text-slate-700">
                              Expected Technical Contribution
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {opp.expectedContribution}
                            </p>
                          </div>

                          <div className="md:col-span-5 space-y-1">
                            <div className="text-xs font-semibold text-slate-700">
                              Targeted Performance Metric & Trade-Off
                            </div>
                            <p className="text-sm font-mono text-slate-800 leading-relaxed tabular-nums">
                              {opp.targetedMetric}
                            </p>
                          </div>
                        </div>

                        {/* Implementation Milestones & Resume Draft */}
                        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-6">
                          {opp.implementationRoadmap && opp.implementationRoadmap.length > 0 && (
                            <div className="md:col-span-7 space-y-1.5">
                              <div className="text-xs font-semibold text-slate-700">
                                3-Milestone Student Execution Plan
                              </div>
                              <ol className="space-y-1 text-xs text-slate-600 list-decimal list-inside">
                                {opp.implementationRoadmap.map((step, sIdx) => (
                                  <li key={sIdx} className="leading-relaxed">
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {opp.resumeBulletDraft && (
                            <div className="md:col-span-5 space-y-1.5">
                              <div className="text-xs font-semibold text-slate-700">
                                Resume Impact Statement
                              </div>
                              <p className="text-xs text-slate-600 italic leading-relaxed">
                                "{opp.resumeBulletDraft}"
                              </p>
                            </div>
                          )}
                        </div>

                        {bpErr && (
                          <p className="text-xs text-red-600 pt-1">Blueprint Error: {bpErr}</p>
                        )}

                        {/* Expanded Starter Code & Evaluation Blueprint */}
                        {blueprint && (
                          <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 bg-slate-50/70 -mx-6 -mb-6 p-6">
                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span className="font-semibold text-slate-900">
                                Starter Repository & PyTorch Implementation Skeleton
                              </span>
                              <span className="font-mono tabular-nums">
                                +{blueprint.tokensUsed} tokens used
                              </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                              <div className="lg:col-span-4 space-y-3">
                                <div>
                                  <div className="text-xs font-semibold text-slate-800 mb-1.5">
                                    Recommended Repo Layout
                                  </div>
                                  <ul className="space-y-1 text-xs font-mono text-slate-600">
                                    {blueprint.repoStructure.map((item, rIdx) => (
                                      <li key={rIdx}>{item}</li>
                                    ))}
                                  </ul>
                                </div>

                                <div>
                                  <div className="text-xs font-semibold text-slate-800 mb-1">
                                    Benchmark & Evaluation Protocol
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed">
                                    {blueprint.evaluationProtocol}
                                  </p>
                                </div>
                              </div>

                              <div className="lg:col-span-8">
                                <pre className="p-4 rounded-md bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                                  {blueprint.starterCodeSnippet}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            PaperForge CS Research Agent · Built for token-efficient academic architecture synthesis
          </span>
          <span className="font-mono tabular-nums">
            Operational Ceiling: 25,000 Tokens · Mermaid.js graph TD Standard
          </span>
        </div>
      </footer>
    </div>
  );
}
