import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Check, Copy, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface MermaidDiagramProps {
  chart: string;
  paperTitle: string;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    nodeSpacing: 38,
    rankSpacing: 46,
    padding: 16,
  },
  themeVariables: {
    primaryColor: '#F8FAFC',
    primaryTextColor: '#0F172A',
    primaryBorderColor: '#1E40AF',
    lineColor: '#475569',
    secondaryColor: '#EFF6FF',
    tertiaryColor: '#F1F5F9',
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: '13px',
  },
});

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, paperTitle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'visual' | 'raw'>('split');

  // Ensure the raw output segment strictly starts with [FLOWCHART] and contains no Markdown code blocks
  const cleanMermaidCode = chart
    .replace(/```mermaid/gi, '')
    .replace(/```/g, '')
    .replace(/^\[FLOWCHART\]\s*/i, '')
    .trim();

  const formattedFlowchartSegment = `[FLOWCHART]\n${cleanMermaidCode}`;

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      try {
        setRenderError(null);
        const uniqueId = `mermaid-graph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const { svg } = await mermaid.render(uniqueId, cleanMermaidCode);
        if (isMounted) {
          setSvgMarkup(svg);
        }
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        if (isMounted) {
          setRenderError(
            'Interactive SVG preview encountered custom node syntax. The validated [FLOWCHART] Mermaid.js source is available directly on the right.'
          );
        }
      }
    };

    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [cleanMermaidCode]);

  const handleCopySegment = async () => {
    try {
      await navigator.clipboard.writeText(formattedFlowchartSegment);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="border border-slate-200 bg-white rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">Mermaid.js System Topology</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">graph TD</span>
          <span aria-hidden="true">·</span>
          <span className="truncate max-w-xs">{paperTitle}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Interactive View Filter Tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-md">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'split'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Split View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'visual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Interactive Graph
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'raw'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              [FLOWCHART] Text
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopySegment}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedRaw ? 'Copied [FLOWCHART]' : 'Copy [FLOWCHART]'}</span>
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div
        className={`grid ${
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
        } divide-y lg:divide-y-0 lg:divide-x divide-slate-200`}
      >
        {/* Visual Mermaid Graph */}
        {(viewMode === 'split' || viewMode === 'visual') && (
          <div
            className={`${
              viewMode === 'split' ? 'lg:col-span-7' : ''
            } relative flex flex-col bg-[#F8FAFC]`}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/80 text-xs text-slate-500">
              <span>Rendered Architecture Graph (Data Inputs → Model Layers → Outputs)</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                  title="Zoom out"
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1.5 tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.75, +(z + 0.15).toFixed(2)))}
                  title="Zoom in"
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  title="Reset zoom"
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded((e) => !e)}
                  title={isExpanded ? 'Compact height' : 'Expand height'}
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors"
                >
                  {isExpanded ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div
              ref={containerRef}
              className={`overflow-auto p-6 flex items-center justify-center transition-opacity duration-150 ${
                isExpanded ? 'min-h-[640px]' : 'min-h-[420px] max-h-[540px]'
              }`}
            >
              {renderError ? (
                <div className="max-w-md text-center p-6 text-xs text-slate-600">
                  <p className="font-medium text-slate-800 mb-1">Mermaid Source Ready</p>
                  <p>{renderError}</p>
                </div>
              ) : (
                <div
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                  className="transition-transform duration-150 w-full flex justify-center"
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              )}
            </div>
          </div>
        )}

        {/* Raw [FLOWCHART] Segment */}
        {(viewMode === 'split' || viewMode === 'raw') && (
          <div
            className={`${
              viewMode === 'split' ? 'lg:col-span-5' : ''
            } flex flex-col bg-slate-950 text-slate-100`}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 text-xs text-slate-400">
              <span className="font-mono">Plain Text Output Segment · No Markdown Fences</span>
              <span className="font-mono tabular-nums">
                {cleanMermaidCode.split('\n').length} lines
              </span>
            </div>
            <pre className="p-5 text-xs font-mono leading-relaxed overflow-x-auto text-slate-200 select-all flex-1">
              {formattedFlowchartSegment}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
