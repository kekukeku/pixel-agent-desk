/**
 * Model Pricing — shared across event processor and scanners
 */

'use strict';

const PRICING_REGISTRY = [
  {
    provider: "openai",
    model: "gpt-4o",
    aliases: ["gpt-4o", "gpt-4o-latest"],
    inputPerMTok: 2.50,
    cachedInputPerMTok: 1.25,
    outputPerMTok: 10.00,
    contextWindow: 128000,
    sourceUrl: "https://openai.com/api/pricing/",
    updatedAt: "2026-06-16"
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    aliases: ["gpt-4o-mini"],
    inputPerMTok: 0.150,
    cachedInputPerMTok: 0.075,
    outputPerMTok: 0.600,
    contextWindow: 128000,
    sourceUrl: "https://openai.com/api/pricing/",
    updatedAt: "2026-06-16"
  },
  {
    provider: "openai",
    model: "o1",
    aliases: ["o1", "o1-preview"],
    inputPerMTok: 15.00,
    cachedInputPerMTok: 7.50,
    outputPerMTok: 60.00,
    contextWindow: 200000,
    sourceUrl: "https://openai.com/api/pricing/",
    updatedAt: "2026-06-16"
  },
  {
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    aliases: ["claude-sonnet-4-5", "claude-sonnet-4-6", "claude-3-5-sonnet-latest", "claude-3-5-sonnet-20241022", "claude-3-5-sonnet"],
    inputPerMTok: 3.00,
    cachedInputPerMTok: 0.30,
    outputPerMTok: 15.00,
    contextWindow: 200000,
    sourceUrl: "https://www.anthropic.com/pricing",
    updatedAt: "2026-06-16"
  },
  {
    provider: "anthropic",
    model: "claude-3-5-haiku",
    aliases: ["claude-haiku-4-5", "claude-haiku-4-6", "claude-3-5-haiku-latest", "claude-3-5-haiku-20241022", "claude-3-5-haiku"],
    inputPerMTok: 0.80,
    cachedInputPerMTok: 0.08,
    outputPerMTok: 4.00,
    contextWindow: 200000,
    sourceUrl: "https://www.anthropic.com/pricing",
    updatedAt: "2026-06-16"
  },
  {
    provider: "anthropic",
    model: "claude-3-opus",
    aliases: ["claude-opus-4-5", "claude-opus-4-6", "claude-3-opus-latest", "claude-3-opus-20240229", "claude-3-opus"],
    inputPerMTok: 15.00,
    cachedInputPerMTok: 1.50,
    outputPerMTok: 75.00,
    contextWindow: 200000,
    sourceUrl: "https://www.anthropic.com/pricing",
    updatedAt: "2026-06-16"
  },
  {
    provider: "google",
    model: "gemini-1.5-pro",
    aliases: ["gemini-1.5-pro", "gemini-1.5-pro-latest"],
    inputPerMTok: 1.25,
    cachedInputPerMTok: 0.3125,
    outputPerMTok: 5.00,
    contextWindow: 2000000,
    sourceUrl: "https://ai.google.dev/pricing",
    updatedAt: "2026-06-16"
  },
  {
    provider: "google",
    model: "gemini-1.5-flash",
    aliases: ["gemini-1.5-flash", "gemini-1.5-flash-latest"],
    inputPerMTok: 0.075,
    cachedInputPerMTok: 0.01875,
    outputPerMTok: 0.30,
    contextWindow: 1000000,
    sourceUrl: "https://ai.google.dev/pricing",
    updatedAt: "2026-06-16"
  },
  {
    provider: "google",
    model: "gemini-2.0-flash",
    aliases: ["gemini-2.0-flash", "gemini-2.0-flash-exp"],
    inputPerMTok: 0.075,
    cachedInputPerMTok: 0.01875,
    outputPerMTok: 0.30,
    contextWindow: 1048576,
    sourceUrl: "https://ai.google.dev/pricing",
    updatedAt: "2026-06-16"
  },
  {
    provider: "xai",
    model: "grok-2",
    aliases: ["grok-2", "grok-2-latest", "grok-beta"],
    inputPerMTok: 2.00,
    cachedInputPerMTok: 1.00,
    outputPerMTok: 10.00,
    contextWindow: 131072,
    sourceUrl: "https://docs.x.ai/docs/overview#pricing",
    updatedAt: "2026-06-16"
  },
  {
    provider: "deepseek",
    model: "deepseek-chat",
    aliases: ["deepseek-chat", "deepseek-v3"],
    inputPerMTok: 0.14,
    cachedInputPerMTok: 0.014,
    outputPerMTok: 0.28,
    contextWindow: 64000,
    sourceUrl: "https://api-docs.deepseek.com/pricing",
    updatedAt: "2026-06-16"
  },
  {
    provider: "deepseek",
    model: "deepseek-reasoner",
    aliases: ["deepseek-reasoner", "deepseek-r1"],
    inputPerMTok: 0.55,
    cachedInputPerMTok: 0.14,
    outputPerMTok: 2.19,
    contextWindow: 64000,
    sourceUrl: "https://api-docs.deepseek.com/pricing",
    updatedAt: "2026-06-16"
  }
];

const DEFAULT_REGISTRY_ENTRY = {
  provider: "generic",
  model: "generic-model",
  aliases: [],
  inputPerMTok: 3.00,
  cachedInputPerMTok: 0.30,
  outputPerMTok: 15.00,
  contextWindow: 200000,
};

function resolveModelPricing(modelName) {
  if (!modelName) return DEFAULT_REGISTRY_ENTRY;
  const lower = modelName.toLowerCase();

  const entry = PRICING_REGISTRY.find(e =>
    e.model.toLowerCase() === lower ||
    e.aliases.some(a => a.toLowerCase() === lower)
  );
  if (entry) return entry;

  const prefixEntry = PRICING_REGISTRY.find(e =>
    lower.startsWith(e.model.toLowerCase()) ||
    e.aliases.some(a => lower.startsWith(a.toLowerCase()))
  );

  return prefixEntry || DEFAULT_REGISTRY_ENTRY;
}

function getContextWindowSize(model) {
  const pricing = resolveModelPricing(model);
  return pricing.contextWindow || 200000;
}

function roundCost(cost) {
  return Math.round(cost * 100000) / 100000;
}

function calculateTokenCost(tokens, modelOverride) {
  const model = tokens.model || modelOverride || null;
  const input = tokens.input || 0;
  const cacheRead = tokens.cacheRead || tokens.cache_read || 0;
  const cacheCreate = tokens.cacheCreate || tokens.cache_create || 0;
  const output = tokens.output || 0;

  const pricing = resolveModelPricing(model);

  const cost = (input * pricing.inputPerMTok +
    cacheRead * pricing.cachedInputPerMTok +
    cacheCreate * (pricing.inputPerMTok * 1.25) +
    output * pricing.outputPerMTok) / 1_000_000;

  return cost;
}

// Legacy compatibility exports
const MODEL_PRICING = {};
const MODEL_CONTEXT_WINDOWS = {};
for (const entry of PRICING_REGISTRY) {
  MODEL_PRICING[entry.model] = { input: entry.inputPerMTok / 1_000_000, output: entry.outputPerMTok / 1_000_000 };
  for (const alias of entry.aliases) {
    MODEL_PRICING[alias] = { input: entry.inputPerMTok / 1_000_000, output: entry.outputPerMTok / 1_000_000 };
    MODEL_CONTEXT_WINDOWS[alias] = entry.contextWindow;
  }
  MODEL_CONTEXT_WINDOWS[entry.model] = entry.contextWindow;
}
const DEFAULT_PRICING = { input: 3 / 1_000_000, output: 15 / 1_000_000 };
const DEFAULT_CONTEXT_WINDOW = 200000;

module.exports = {
  PRICING_REGISTRY,
  resolveModelPricing,
  calculateTokenCost,
  getContextWindowSize,
  roundCost,
  // Legacy compatibility exports
  MODEL_PRICING,
  DEFAULT_PRICING,
  MODEL_CONTEXT_WINDOWS,
  DEFAULT_CONTEXT_WINDOW
};
