// bot/claude.js — Único punto de contacto con Anthropic.
// Regla de oro #1: Claude SOLO redacta. No toma decisiones, no consulta DB.
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const { logAiUsage } = require('../db/queries/sessions');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS || '300', 10);
const IN_PRICE = parseFloat(process.env.CLAUDE_INPUT_PRICE_PER_MILLION || '3.00');
const OUT_PRICE = parseFloat(process.env.CLAUDE_OUTPUT_PRICE_PER_MILLION || '15.00');

const SYSTEM_PROMPT = [
  'Eres un asistente de mensajería para WhatsApp.',
  'Tu único trabajo es redactar el mensaje indicado con naturalidad.',
  'No tomes decisiones. No agregues info extra. No hagas preguntas.',
  'Responde SOLO con el mensaje final, sin comillas, sin explicaciones.',
  'Reglas: español mexicano, tuteo, máx 3 líneas, nunca menciones que eres IA.',
].join('\n');

function computeCost(inputTokens, outputTokens) {
  return (inputTokens / 1e6) * IN_PRICE + (outputTokens / 1e6) * OUT_PRICE;
}

// Redacta un mensaje a partir de una instrucción ya construida por Node.js.
// Si Claude falla, devuelve el fallbackText para no bloquear al usuario.
async function draftMessage({ tenant, instruction, fallbackText, conversationId = null }) {
  const userPrompt = [
    `Tono: ${tenant.config.bot_tone}`,
    `Emojis: ${tenant.config.emoji_level}`,
    `Comunica: ${instruction}`,
  ].join('\n');

  const startedAt = Date.now();
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = (resp.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join(' ')
      .trim();

    const inputTokens = resp.usage?.input_tokens || 0;
    const outputTokens = resp.usage?.output_tokens || 0;

    await logAiUsage({
      tenantId: tenant.id, model: MODEL, route: 'message_drafting',
      inputTokens, outputTokens, costUsd: computeCost(inputTokens, outputTokens),
      latencyMs: Date.now() - startedAt, success: true, conversationId,
    });

    return text || fallbackText;
  } catch (err) {
    logger.error('Claude draftMessage falló', { error: err.message });
    await logAiUsage({
      tenantId: tenant.id, model: MODEL, route: 'message_drafting',
      inputTokens: 0, outputTokens: 0, costUsd: 0,
      latencyMs: Date.now() - startedAt, success: false, errorCode: err.message?.slice(0, 100),
      conversationId,
    });
    return fallbackText;
  }
}

module.exports = { draftMessage, computeCost, MODEL };
