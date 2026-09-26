import { AnalyzedPaper } from '../types';

export const PRESET_PAPERS: AnalyzedPaper[] = [
  {
    id: 'preset-mamba-2312',
    title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
    authors: 'Albert Gu, Tri Dao',
    venueOrYear: 'COLM 2024 · arXiv:2312.00752',
    sourceUrl: 'https://arxiv.org/abs/2312.00752',
    githubRepoUrl: 'https://github.com/state-spaces/mamba',
    analyzedAt: '2026-09-25T18:30:00.000Z',
    coreConcept: {
      problemStatement:
        'Transformer architectures dominate sequence modeling across language, genomics, and audio, but their self-attention mechanism scales quadratically with sequence length O(L²). Previous subquadratic alternatives—such as linear attention and structured state space models (SSMs)—achieve linear scaling by enforcing time-invariance, which prevents them from selectively focusing on or ignoring specific inputs based on content.',
      primaryMethodology:
        'Mamba introduces Selective State Space Models (S6), making the state space parameters (step size Δ, input projection B, and output projection C) direct functions of the current input token. Because input-dependent parameters break traditional FFT-based convolution training, the authors embed the selective SSM inside a simplified, attention-free gated neural block and design a hardware-aware parallel scan kernel.',
      algorithmicBreakthroughs:
        'By fusing discretization, selective associative scan, and output projection inside SRAM (on-chip GPU memory) rather than materializing the huge hidden state tensor in slow HBM (high-bandwidth DRAM), Mamba achieves O(L) time complexity during training and O(1) constant memory per step during autoregressive generation—delivering 5× higher inference throughput than Transformers of equivalent scale.',
      wordCount: 179,
    },
    mermaidFlowchart: `graph TD
  A["Input Token Sequence X (B, L, D)"] --> B["Linear Projection (Expand 2x to 2ED)"]
  B --> C["SSM Path: 1D Depthwise Convolution + SiLU"]
  B --> D["Gating Path: SiLU Activation"]
  C --> E["Input-Dependent Selection: Linear(x) -> B_t, C_t, Delta_t"]
  E --> F["Zero-Order Hold Discretization in GPU SRAM"]
  F --> G["Hardware-Aware Associative Parallel Scan (h_t = A_bar h_{t-1} + B_bar x_t)"]
  G --> H["State Output Projection (y_t = C_t h_t + D x_t)"]
  H --> I["Element-wise Multiplicative Gate with SiLU Path"]
  D --> I
  I --> J["Output Linear Projection (Contract to D) + Residual Add"]`,
    opportunities: [
      {
        title: 'Hybrid Mamba-Attention KV-Cache Compressor for Long-Context RAG',
        expectedContribution:
          'Interleaving 1 shared GQA (Grouped-Query Attention) layer for every 7 Mamba-S6 blocks in a 350M parameter language model to preserve exact needle-in-a-stack retrieval while keeping memory nearly linear.',
        targetedMetric:
          '68% reduction in KV-cache VRAM footprint at 32K context length with <0.8% drop on Passkey Retrieval accuracy.',
        recommendedTechStack: [
          'PyTorch',
          'mamba-ssm',
          'FlashAttention-2',
          'HuggingFace Accelerate',
        ],
        implementationRoadmap: [
          'Build a configurable hybrid block wrapper in PyTorch alternating Mamba S6 layers and rotary-pe GQA layers.',
          'Distill weights from a pretrained 350M Transformer on FineWeb-Edu 1B token subset using KL-divergence loss.',
          'Benchmark peak VRAM allocation, prefill latency, and synthetic Needle-in-a-Haystack retrieval across 4K to 32K sequences.',
        ],
        resumeBulletDraft:
          'Engineered a hybrid Mamba-GQA sequence architecture in PyTorch that reduced 32K-context KV-cache memory by 68% while maintaining 99.2% needle retrieval accuracy.',
      },
      {
        title: 'INT8 Quantized Mamba Selective Scan for Edge ARM / ONNX Deployment',
        expectedContribution:
          'Replacing the CUDA-only selective scan operator with a portable, cache-tiled C++/ONNX custom operator using dynamic per-channel INT8 weight quantization for edge CPU execution.',
        targetedMetric:
          '2.4× token generation speedup on Apple Silicon / Raspberry Pi 5 CPU with <1.1% WikiText-2 perplexity degradation.',
        recommendedTechStack: ['PyTorch', 'ONNX Runtime', 'C++17 NEON Intrinsics', 'Optimum'],
        implementationRoadmap: [
          'Export the recurrent step mode of Mamba into a clean stateful ONNX graph taking (input_id, conv_state, ssm_state).',
          'Apply symmetric INT8 quantization to the input/output linear projections while keeping the recurrent state update in FP16/FP32.',
          'Profile tokens-per-second and memory bandwidth utilization across sequence lengths from 512 to 8,192 tokens.',
        ],
        resumeBulletDraft:
          'Developed a stateful ONNX Runtime inference pipeline with INT8 weight quantization for Mamba SSMs, achieving 2.4× faster autoregressive decoding on edge ARM CPUs.',
      },
      {
        title: 'Bidirectional Vision-Mamba Patch Encoder for High-Resolution Medical Imaging',
        expectedContribution:
          'Extending unidirectional Mamba selective scans to 2D four-way cross-scans over image patches to replace quadratic Vision Transformer (ViT) encoders on 1024×1024 histopathology slides.',
        targetedMetric:
          '4.1× lower FLOPs and 52% lower training memory at 1024×1024 resolution while matching ViT-Base AUROC within 0.4%.',
        recommendedTechStack: ['PyTorch', 'timm', 'Triton', 'MONAI'],
        implementationRoadmap: [
          'Implement a 2D patch flattening module that traverses image tokens along 4 directional scan paths before merging outputs.',
          'Train on MedMNIST / Camelyon16 patches and compare GPU memory scaling curves against standard ViT-B/16.',
          'Visualize effective receptive fields and input-dependent Δ_t activation maps to interpret diagnostic regions.',
        ],
        resumeBulletDraft:
          'Architected a 4-way directional Vision-Mamba encoder in PyTorch and Triton for high-resolution medical imaging, cutting GPU training memory by 52% vs. ViT-Base.',
      },
    ],
    tokenUsage: {
      promptTokens: 512,
      outputTokens: 894,
      totalTokens: 1406,
      budgetLimit: 25000,
      strategyUsed: 'Abstract + Official GitHub Context (state-spaces/mamba)',
    },
    groundingSources: [
      {
        title: 'arXiv:2312.00752 — Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
        uri: 'https://arxiv.org/abs/2312.00752',
      },
      {
        title: 'state-spaces/mamba Official Repository (GitHub)',
        uri: 'https://github.com/state-spaces/mamba',
      },
    ],
  },
  {
    id: 'preset-flashattention2-2307',
    title: 'FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning',
    authors: 'Tri Dao',
    venueOrYear: 'ICLR 2024 · arXiv:2307.08691',
    sourceUrl: 'https://arxiv.org/abs/2307.08691',
    githubRepoUrl: 'https://github.com/Dao-AILab/flash-attention',
    analyzedAt: '2026-09-25T17:15:00.000Z',
    coreConcept: {
      problemStatement:
        'Although the original FlashAttention eliminated O(N²) HBM memory reads/writes via tiling and online softmax, it still only reached 25–40% of theoretical peak FLOPs on A100 GPUs. The bottleneck stemmed from suboptimal thread-block scheduling across Streaming Multiprocessors (SMs), excessive non-matmul operations, and shared-memory synchronization overhead between warps.',
      primaryMethodology:
        'FlashAttention-2 redesigns the GPU kernel across three dimensions: (1) algorithmic tweaking of the online softmax rescaling to defer division until the very end of the loop, (2) parallelizing across the sequence-length dimension in addition to batch and head dimensions to keep all GPU SMs saturated even for small batches, and (3) partitioning work across warps to avoid shared-memory split-K reductions.',
      algorithmicBreakthroughs:
        'ByMaintaining running log-sum-exp statistics without rescaling intermediate output tiles at every inner iteration and splitting Q across 4 warps while keeping K and V shared, FlashAttention-2 cuts non-matmul FLOPs and shared-memory traffic, achieving up to 73% of theoretical peak FP16/BF16 Tensor Core throughput (2× faster than FlashAttention-1).',
      wordCount: 171,
    },
    mermaidFlowchart: `graph TD
  A["Input Tensors Q, K, V in GPU HBM (B, H, N, d)"] --> B["Outer Scheduler: Parallelize across Batch, Heads, and Sequence Blocks (N / B_r)"]
  B --> C["Load Q_i Tile into On-Chip SRAM (Split across 4 Warps)"]
  C --> D["Inner Loop j: Stream K_j, V_j Tiles from HBM to Shared Memory"]
  D --> E["Tensor Core MMA: Compute S_ij = Q_i K_j^T (Causal Mask Applied)"]
  E --> F["Online Softmax Update: m_i^new = max(m_i, rowmax(S_ij))"]
  F --> G["Unnormalized Accumulator: O_i = diag(exp(m_i^old - m_i^new)) O_i + exp(S_ij - m_i^new) V_j"]
  G --> H["End of Loop Epilogue: Final Normalization O_i = diag(l_i)^(-1) O_i"]
  H --> I["Write Output Tile O_i and LogSumExp L_i back to HBM"]`,
    opportunities: [
      {
        title: 'Custom Triton Sliding-Window + Sink-Token Attention Kernel',
        expectedContribution:
          'Implementing a FlashAttention-2 style tiled kernel in OpenAI Triton that fuses a fixed 4 initial attention sink tokens with a local sliding window of 1024 tokens, completely skipping masked tile blocks.',
        targetedMetric:
          '3.8× speedup over dense causal FlashAttention-2 at 16K sequence length with zero perplexity spike in streaming generation.',
        recommendedTechStack: ['OpenAI Triton', 'PyTorch', 'CUDA Profiler (Nsight Compute)'],
        implementationRoadmap: [
          'Write a forward pass Triton kernel that loads the first 1 block of K/V (sink tokens) plus the diagonal sliding window blocks.',
          'Verify numerical equivalence in FP16 against a PyTorch reference mask using torch.testing.assert_close.',
          'Benchmark TFLOPs/s and memory bandwidth across sequence lengths from 2K to 32K on an NVIDIA T4/A10/RTX GPU.',
        ],
        resumeBulletDraft:
          'Implemented a block-sparse Sliding-Window + Attention-Sink kernel in OpenAI Triton, accelerating 16K-context LLM prefill by 3.8× over dense attention.',
      },
      {
        title: 'Alibi & RoPE Fused On-Chip Positional Bias in Triton FlashAttention',
        expectedContribution:
          'Fusing ALiBi linear distance biases and Rotary Position Embeddings (RoPE) directly inside the SRAM tile loop before the online softmax step to eliminate separate HBM read/write passes.',
        targetedMetric:
          '14% end-to-end attention layer latency reduction and 22% fewer HBM memory transactions.',
        recommendedTechStack: ['OpenAI Triton', 'PyTorch', 'pytest-benchmark'],
        implementationRoadmap: [
          'Modify the QK^T accumulator in SRAM to add per-head slope * (q_idx - k_idx) on the fly in registers.',
          'Benchmark isolated kernel latency and HBM traffic against unfused PyTorch RoPE + SDPA baseline.',
          'Package as a drop-in torch.nn.Module replacement with automated unit tests.',
        ],
        resumeBulletDraft:
          'Fused positional embedding and ALiBi bias computation into SRAM registers inside a Triton FlashAttention-2 kernel, cutting HBM memory traffic by 22%.',
      },
      {
        title: 'FP8 KV-Cache Dequantization-on-the-Fly inside Tiled Attention',
        expectedContribution:
          'Storing K and V tensors in 8-bit floating point (E4M3) in HBM and dequantizing tiles into BF16 only after loading into on-chip SRAM during autoregressive decoding.',
        targetedMetric:
          '50% KV-cache memory reduction and 1.65× higher batch decoding throughput on memory-bandwidth-bound workloads.',
        recommendedTechStack: ['PyTorch', 'OpenAI Triton', 'vLLM'],
        implementationRoadmap: [
          'Implement per-head scale factor calibration and FP8 E4M3 storage for K/V cache buffers.',
          'Add register-level FP8-to-BF16 cast and scale multiplication inside the Triton K_j/V_j tile loader.',
          'Evaluate throughput (tokens/sec) at batch sizes 16–64 against standard FP16 KV-cache.',
        ],
        resumeBulletDraft:
          'Built an on-chip FP8-to-BF16 KV-cache dequantization kernel in Triton, halving GPU memory usage and boosting batched LLM decoding throughput by 1.65×.',
      },
    ],
    tokenUsage: {
      promptTokens: 488,
      outputTokens: 862,
      totalTokens: 1350,
      budgetLimit: 25000,
      strategyUsed: 'Abstract + Official GitHub Context (Dao-AILab/flash-attention)',
    },
    groundingSources: [
      {
        title: 'arXiv:2307.08691 — FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning',
        uri: 'https://arxiv.org/abs/2307.08691',
      },
      {
        title: 'Dao-AILab/flash-attention Repository (GitHub)',
        uri: 'https://github.com/Dao-AILab/flash-attention',
      },
    ],
  },
  {
    id: 'preset-lora-2106',
    title: 'LoRA: Low-Rank Adaptation of Large Language Models',
    authors: 'Edward J. Hu, Yelong Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang, Lu Wang, Weizhu Chen',
    venueOrYear: 'ICLR 2022 · arXiv:2106.09685',
    sourceUrl: 'https://arxiv.org/abs/2106.09685',
    githubRepoUrl: 'https://github.com/microsoft/LoRA',
    analyzedAt: '2026-09-25T16:00:00.000Z',
    coreConcept: {
      problemStatement:
        'Full fine-tuning of large pretrained language models requires storing and updating billions of parameters along with their optimizer states, making task-specific adaptation prohibitively expensive in GPU memory and storage. Earlier parameter-efficient methods like adapter layers add sequential bottleneck operations that increase inference latency, while prefix-tuning reduces usable sequence length.',
      primaryMethodology:
        'Inspired by the hypothesis that weight updates during model adaptation have a low "intrinsic rank", LoRA freezes the original pretrained weight matrix W_0 (d × k) and injects trainable rank-decomposition matrices A (r × k) and B (d × r), where rank r << min(d, k), in parallel to existing linear projections.',
      algorithmicBreakthroughs:
        'During training, gradients only flow through A and B, cutting trainable parameters by up to 10,000× and GPU VRAM requirements by 3×. Crucially, because the update ΔW = B·A is purely linear, at deployment time the learned adapter can be merged directly into the frozen base weights (W = W_0 + (α/r)B·A), introducing zero additional inference latency.',
      wordCount: 168,
    },
    mermaidFlowchart: `graph TD
  A["Input Activation Vector x (d_in)"] --> B["Frozen Pretrained Weight Matrix W_0 (d_out x d_in) — No Gradients"]
  A --> C["Trainable Down-Projection Matrix A (r x d_in) — Gaussian Init"]
  C --> D["Low-Rank Bottleneck Representation (rank r << d_in)"]
  D --> E["Trainable Up-Projection Matrix B (d_out x r) — Zero Init"]
  E --> F["Scale by Constant Factor (alpha / r)"]
  B --> G["Element-wise Vector Summation: h = W_0 x + (alpha / r) B A x"]
  F --> G
  G --> H["Deployment Option: Merge W_merged = W_0 + (alpha / r) B A for Zero-Latency Inference"]`,
    opportunities: [
      {
        title: 'Dynamic Layer-Wise Rank Allocation via Singular Value Pruning (AdaLoRA-Lite)',
        expectedContribution:
          'Parameterized LoRA adapters in SVD form (P·Λ·Q) that dynamically prune unimportant singular values during fine-tuning to allocate higher rank r to critical upper attention layers and lower rank to early layers.',
        targetedMetric:
          '40% fewer trainable adapter parameters at identical GLUE /GSM8K fine-tuning accuracy compared to uniform r=16 LoRA.',
        recommendedTechStack: ['PyTorch', 'HuggingFace PEFT', 'Weights & Biases', 'Datasets'],
        implementationRoadmap: [
          'Implement an SVD-parameterized LoRA linear layer with orthogonality regularization on P and Q.',
          'Add an importance-score moving average based on magnitude and gradient sensitivity to mask singular values every 100 steps.',
          'Compare parameter efficiency vs. uniform LoRA (r=8, 16) on Llama-3.2-1B / RoBERTa-large.',
        ],
        resumeBulletDraft:
          'Built a dynamic SVD rank-allocation framework for LoRA in PyTorch that reduced trainable adapter parameters by 40% with zero accuracy loss on GSM8K.',
      },
      {
        title: 'Multi-Tenant Batched LoRA Serving Router (S-LoRA / Punica Style)',
        expectedContribution:
          'Building a custom batched matrix-multiplication dispatcher that routes heterogeneous requests in the same batch to up to 16 distinct task-specific LoRA adapters stored in contiguous GPU memory.',
        targetedMetric:
          '4.2× higher multi-adapter request throughput (req/sec) compared to sequential adapter swapping.',
        recommendedTechStack: ['PyTorch', 'FastAPI', 'OpenAI Triton', 'locust'],
        implementationRoadmap: [
          'Keep the shared base model weights W_0 in a single batched GEMM while grouping token indices by adapter_id for the B·A pass.',
          'Implement a FastAPI inference server supporting dynamic adapter loading from disk into an LRU GPU cache.',
          'Run load testing with 16 concurrent domain adapters under Poisson request arrivals.',
        ],
        resumeBulletDraft:
          'Engineered a multi-tenant LoRA inference server in PyTorch and FastAPI capable of batching 16 distinct adapters concurrently, increasing throughput by 4.2×.',
      },
      {
        title: '4-Bit NormalFloat Quantized Base + FP16 LoRA (QLoRA from Scratch)',
        expectedContribution:
          'Implementing block-wise 4-bit NormalFloat (NF4) weight quantization with double quantization of scale constants from scratch in PyTorch to fine-tune a 3B/7B model on a single free-tier 16GB T4 GPU.',
        targetedMetric:
          '65% reduction in base model VRAM footprint while recovering 99.3% of 16-bit LoRA fine-tuning performance.',
        recommendedTechStack: ['PyTorch', 'bitsandbytes', 'TRL', 'CUDA'],
        implementationRoadmap: [
          'Implement quantile-based 16-bin NF4 lookup table quantization with block size 64 for frozen Linear weights.',
          'Attach trainable BF16/FP16 LoRA (A, B) matrices and verify gradient flow through the dequantized forward hook.',
          'Benchmark peak memory usage and training throughput on an instruction-tuning dataset.',
        ],
        resumeBulletDraft:
          'Implemented block-wise NF4 weight quantization with FP16 LoRA adapters in PyTorch, cutting fine-tuning GPU memory by 65% to fit 7B models on a 16GB GPU.',
      },
    ],
    tokenUsage: {
      promptTokens: 445,
      outputTokens: 820,
      totalTokens: 1265,
      budgetLimit: 25000,
      strategyUsed: 'Abstract + Official GitHub Context (microsoft/LoRA)',
    },
    groundingSources: [
      {
        title: 'arXiv:2106.09685 — LoRA: Low-Rank Adaptation of Large Language Models',
        uri: 'https://arxiv.org/abs/2106.09685',
      },
      {
        title: 'microsoft/LoRA Official Repository (GitHub)',
        uri: 'https://github.com/microsoft/LoRA',
      },
    ],
  },
];
