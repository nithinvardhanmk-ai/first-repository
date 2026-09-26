import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizePaperInput(rawInput = '') {
  const trimmed = String(rawInput || '').trim();
  // Convert heavy arXiv PDF URLs to lightweight abstract URLs for token efficiency
  const arxivPdfMatch = trimmed.match(/arxiv\.org\/pdf\/([0-9]+\.[0-9]+)(v[0-9]+)?(\.pdf)?/i);
  if (arxivPdfMatch) {
    const arxivId = arxivPdfMatch[1];
    return {
      cleanedInput: trimmed,
      optimizedUrl: `https://arxiv.org/abs/${arxivId}`,
      strategyLabel: 'arXiv PDF redirected to Abstract + Web Search Grounding',
    };
  }

  const isUrl = /^https?:\/\//i.test(trimmed);
  if (isUrl) {
    return {
      cleanedInput: trimmed,
      optimizedUrl: trimmed,
      strategyLabel: 'URL Context + Abstract & GitHub Search Grounding',
    };
  }

  return {
    cleanedInput: trimmed,
    optimizedUrl: null,
    strategyLabel: 'Title & Abstract Web Search Grounding',
  };
}

function sanitizeMermaidString(raw = '') {
  let cleaned = String(raw || '')
    .replace(/```mermaid/gi, '')
    .replace(/```/g, '')
    .replace(/^\[FLOWCHART\]\s*/i, '')
    .trim();

  if (!cleaned.startsWith('graph TD') && !cleaned.startsWith('flowchart TD')) {
    cleaned = `graph TD\n${cleaned}`;
  }
  return cleaned;
}

function countWords(text = '') {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  app.post('/api/analyze-paper', async (req, res) => {
    try {
      const paperUrlOrQuery = req.body?.paperUrlOrQuery;
      if (!paperUrlOrQuery || !String(paperUrlOrQuery).trim()) {
        res.status(400).json({ error: 'Please provide a valid research paper URL or title.' });
        return;
      }

      const ai = getAiClient();
      const { cleanedInput, optimizedUrl, strategyLabel } = normalizePaperInput(paperUrlOrQuery);

      const systemInstruction = `You are an advanced Computer Science Research Agent specializing in parsing academic papers, extracting system architectures, and identifying student development opportunities.

OPERATIONAL CONSTRAINTS:
- Prioritize strict token efficiency. Keep your entire analysis concise, high-signal, and well under 25,000 total tokens.
- Rather than ingesting entire multi-page PDFs verbatim, rely on abstracts, methodology summaries, algorithmic equations, and open-source implementations (such as GitHub repositories) for the paper.

Execute these three steps and return ONLY a valid JSON object matching the exact structure below (no markdown code fences around the JSON):

1. CORE CONCEPT EXTRACTION:
Summarize the problem statement, the primary methodology introduced, and the key mathematical/algorithmic breakthroughs in UNDER 300 WORDS total using plain, accessible language.

2. ARCHITECTURAL FLOWCHART (Mermaid.js):
Generate a clean, syntactically valid Mermaid.js flowchart starting with "graph TD" that charts the components, data inputs, model layers, and data outputs of the system described in the paper.
CRITICAL MERMAID SYNTAX RULES:
- Start with "graph TD" on the first line.
- Use simple alphanumeric node IDs like A, B, C, D, E, F, G, H.
- Wrap ALL node labels in double quotes inside square brackets, e.g.: A["Input Token Sequence (B, L, D)"] --> B["Selective State Space Layer"]
- Wrap edge labels in double quotes or simple text without parentheses or brackets, e.g.: A -->|Projects to| B
- NEVER use Markdown code blocks (\`\`\`) inside the mermaidFlowchart string.

3. FUTURE WORK & INTERNSHIP OPPORTUNITIES:
Brainstorm 3 concrete, realistic ways a 3rd-year CS student could build upon, extend, or optimize this paper for a resume project. For each idea provide:
- title: Short descriptive project title
- expectedContribution: Concrete technical contribution (e.g., "Replacing the heavy transformer layer with a lightweight Mamba block for edge deployment")
- targetedMetric: Specific quantifiable metric & trade-off (e.g., "35% inference latency reduction on ARM CPU with <1.2% perplexity degradation")
- recommendedTechStack: Array of 3 to 5 specific tools/libraries (e.g., ["PyTorch", "ONNX Runtime", "Triton", "HuggingFace Transformers"])
- implementationRoadmap: Array of 3 short, actionable engineering milestones for a 3rd-year CS student
- resumeBulletDraft: A strong 1-sentence resume bullet point ready for a SWE/ML internship application

Required JSON schema format:
{
  "title": "Full Official Paper Title",
  "authors": "Primary Authors (e.g., Albert Gu, Tri Dao)",
  "venueOrYear": "Publication Venue & Year (e.g., COLM 2024 / arXiv 2023)",
  "sourceUrl": "Canonical URL to the paper",
  "githubRepoUrl": "Official or primary community GitHub repository URL if known, else empty string",
  "coreConcept": {
    "problemStatement": "Plain-language explanation of the core bottleneck or problem (60-85 words)",
    "primaryMethodology": "Plain-language explanation of the proposed system and architecture (75-95 words)",
    "algorithmicBreakthroughs": "Key mathematical or algorithmic insight that makes it work (70-90 words)"
  },
  "mermaidFlowchart": "graph TD\\n  A[\\"Data Input\\"] --> B[\\"Model Layer\\"]",
  "opportunities": [
    {
      "title": "...",
      "expectedContribution": "...",
      "targetedMetric": "...",
      "recommendedTechStack": ["...", "..."],
      "implementationRoadmap": ["Step 1...", "Step 2...", "Step 3..."],
      "resumeBulletDraft": "..."
    }
  ]
}`;

      const userPrompt = optimizedUrl
        ? `Analyze the Computer Science research paper at this URL: ${optimizedUrl} (Original input: ${cleanedInput}). Look up its abstract, architectural summary, and official GitHub implementation if needed, and return the required JSON object.`
        : `Find and analyze the Computer Science research paper "${cleanedInput}". Look up its abstract, architectural summary, and official GitHub implementation, and return the required JSON object.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: optimizedUrl
            ? [{ urlContext: {} }, { googleSearch: {} }]
            : [{ googleSearch: {} }],
        },
      });

      const rawText = response.text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse structured research extraction from model response.');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const problemStatement = String(parsed?.coreConcept?.problemStatement || '').trim();
      const primaryMethodology = String(parsed?.coreConcept?.primaryMethodology || '').trim();
      const algorithmicBreakthroughs = String(
        parsed?.coreConcept?.algorithmicBreakthroughs || ''
      ).trim();

      const unifiedSummary = `${problemStatement} ${primaryMethodology} ${algorithmicBreakthroughs}`.trim();
      const totalWords = countWords(unifiedSummary);

      const mermaidFlowchart = sanitizeMermaidString(String(parsed?.mermaidFlowchart || ''));

      // Extract grounding sources
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundingSources = [];
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          groundingSources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
      }

      const promptTokens = response.usageMetadata?.promptTokenCount || 480;
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 920;
      const totalTokens =
        response.usageMetadata?.totalTokenCount || promptTokens + outputTokens;

      res.json({
        id: `paper-${Date.now()}`,
        title: parsed.title || cleanedInput,
        authors: parsed.authors || 'Research Authors',
        venueOrYear: parsed.venueOrYear || 'arXiv Preprint',
        sourceUrl: parsed.sourceUrl || optimizedUrl || cleanedInput,
        githubRepoUrl: parsed.githubRepoUrl || '',
        analyzedAt: new Date().toISOString(),
        coreConcept: {
          problemStatement,
          primaryMethodology,
          algorithmicBreakthroughs,
          wordCount: totalWords,
        },
        mermaidFlowchart,
        opportunities: Array.isArray(parsed.opportunities)
          ? parsed.opportunities.slice(0, 3)
          : [],
        tokenUsage: {
          promptTokens,
          outputTokens,
          totalTokens,
          budgetLimit: 25000,
          strategyUsed: strategyLabel,
        },
        groundingSources: groundingSources.slice(0, 6),
      });
    } catch (error) {
      console.error('Error in /api/analyze-paper:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to analyze research paper.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/generate-blueprint', async (req, res) => {
    try {
      const { paperTitle, opportunity } = req.body;
      if (!paperTitle || !opportunity) {
        res.status(400).json({ error: 'Missing paperTitle or opportunity payload.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate a concise, token-efficient 3rd-year CS student implementation blueprint for extending "${paperTitle}" with the project "${opportunity.title}".
Expected Contribution: ${opportunity.expectedContribution}
Target Metric: ${opportunity.targetedMetric}
Tech Stack: ${(opportunity.recommendedTechStack || []).join(', ')}

Return ONLY valid JSON (no markdown code blocks) with:
{
  "repoStructure": ["src/model.py - ...", "src/benchmark.py - ...", "configs/experiment.yaml - ...", "README.md - ..."],
  "starterCodeSnippet": "A clean 18-25 line PyTorch/Python code skeleton demonstrating the core architectural modification and metric hook",
  "evaluationProtocol": "A 2-sentence explanation of datasets, baseline comparison, and hardware profiling setup to validate the targeted performance metric."
}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText);
      const tokensUsed = response.usageMetadata?.totalTokenCount || 410;

      res.json({
        ...parsed,
        tokensUsed,
      });
    } catch (error) {
      console.error('Error in /api/generate-blueprint:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate starter blueprint.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PaperForge server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
