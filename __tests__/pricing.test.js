/**
 * pricing.js Tests
 * Verification of multi-provider pricing registry, aliases, cost calculations, and context windows
 */

'use strict';

const {
  getContextWindowSize,
  resolveModelPricing,
  calculateTokenCost,
  roundCost,
  MODEL_CONTEXT_WINDOWS,
  DEFAULT_CONTEXT_WINDOW,
  MODEL_PRICING
} = require('../src/pricing');

describe('Model Pricing Registry', () => {
  describe('resolveModelPricing', () => {
    test('resolves known models from different providers', () => {
      // OpenAI
      const o1 = resolveModelPricing('o1');
      expect(o1.provider).toBe('openai');
      expect(o1.contextWindow).toBe(200000);

      // Anthropic
      const sonnet = resolveModelPricing('claude-3-5-sonnet-latest');
      expect(sonnet.provider).toBe('anthropic');
      expect(sonnet.contextWindow).toBe(200000);

      // Google
      const gemini = resolveModelPricing('gemini-1.5-pro');
      expect(gemini.provider).toBe('google');
      expect(gemini.contextWindow).toBe(2000000);

      // xAI
      const grok = resolveModelPricing('grok-beta');
      expect(grok.provider).toBe('xai');
      expect(grok.contextWindow).toBe(131072);

      // DeepSeek
      const deepseek = resolveModelPricing('deepseek-chat');
      expect(deepseek.provider).toBe('deepseek');
      expect(deepseek.contextWindow).toBe(64000);
    });

    test('returns default registry entry for unknown models', () => {
      const unknown = resolveModelPricing('not-a-real-model');
      expect(unknown.provider).toBe('generic');
      expect(unknown.contextWindow).toBe(200000);
    });
  });

  describe('getContextWindowSize', () => {
    test('returns correct size for known models', () => {
      expect(getContextWindowSize('claude-opus-4-6')).toBe(200000);
      expect(getContextWindowSize('gemini-1.5-flash')).toBe(1000000);
      expect(getContextWindowSize('gpt-4o-mini')).toBe(128000);
    });

    test('returns default for unknown model', () => {
      expect(getContextWindowSize('completely-unknown-model')).toBe(DEFAULT_CONTEXT_WINDOW);
    });

    test('returns default for null/undefined/empty', () => {
      expect(getContextWindowSize(null)).toBe(DEFAULT_CONTEXT_WINDOW);
      expect(getContextWindowSize(undefined)).toBe(DEFAULT_CONTEXT_WINDOW);
      expect(getContextWindowSize('')).toBe(DEFAULT_CONTEXT_WINDOW);
    });
  });

  describe('calculateTokenCost', () => {
    test('calculates correct cost for OpenAI (gpt-4o)', () => {
      // Test with gpt-4o: input = 2.50/M, cached = 1.25/M, output = 10.00/M
      const cost = calculateTokenCost({
        input: 100000,        // 0.1M * 2.5 = 0.25
        cacheRead: 200000,    // 0.2M * 1.25 = 0.25
        output: 50000,        // 0.05M * 10 = 0.50
      }, 'gpt-4o');

      expect(roundCost(cost)).toBe(1.00); // 0.25 + 0.25 + 0.50 = 1.00
    });

    test('calculates correct cost for Anthropic (claude-3-5-sonnet)', () => {
      // input = 3.00/M, cached = 0.30/M, output = 15.00/M
      const cost = calculateTokenCost({
        input: 100000,        // 0.1M * 3 = 0.30
        cacheRead: 100000,    // 0.1M * 0.3 = 0.03
        output: 10000,        // 0.01M * 15 = 0.15
      }, 'claude-3-5-sonnet');

      expect(roundCost(cost)).toBe(0.48); // 0.30 + 0.03 + 0.15 = 0.48
    });

    test('calculates correct cost for Google (gemini-1.5-pro)', () => {
      // input = 1.25/M, cached = 0.3125/M, output = 5.00/M
      const cost = calculateTokenCost({
        input: 100000,        // 0.1M * 1.25 = 0.125
        cacheRead: 200000,    // 0.2M * 0.3125 = 0.0625
        output: 50000,        // 0.05M * 5 = 0.25
      }, 'gemini-1.5-pro');

      expect(roundCost(cost)).toBe(0.4375); // 0.125 + 0.0625 + 0.25 = 0.4375
    });

    test('calculates correct cost for xAI (grok-2)', () => {
      // input = 2.00/M, cached = 1.00/M, output = 10.00/M
      const cost = calculateTokenCost({
        input: 100000,        // 0.1M * 2 = 0.20
        cacheRead: 100000,    // 0.1M * 1 = 0.10
        output: 10000,        // 0.01M * 10 = 0.10
      }, 'grok-beta');

      expect(roundCost(cost)).toBe(0.40); // 0.20 + 0.10 + 0.10 = 0.40
    });

    test('calculates correct cost for DeepSeek (deepseek-chat)', () => {
      // input = 0.14/M, cached = 0.014/M, output = 0.28/M
      const cost = calculateTokenCost({
        input: 1000000,       // 1.0M * 0.14 = 0.14
        cacheRead: 1000000,   // 1.0M * 0.014 = 0.014
        output: 1000000,      // 1.0M * 0.28 = 0.28
      }, 'deepseek-chat');

      expect(roundCost(cost)).toBe(0.434); // 0.14 + 0.014 + 0.28 = 0.434
    });
  });

  describe('Legacy compatibility exports', () => {
    test('MODEL_CONTEXT_WINDOWS covers all MODEL_PRICING keys', () => {
      for (const model of Object.keys(MODEL_PRICING)) {
        // Use array wrapped key to prevent Jest from interpreting dots as property path
        expect(MODEL_CONTEXT_WINDOWS).toHaveProperty([model]);
      }
    });
  });
});
