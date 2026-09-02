/**
 * Arquivo: backend/routes/search.routes.ts
 * Propósito: Define os "caminhos" (rotas) da API. Quando o frontend faz um 
 * request para `/api/qualquer-coisa`, é este arquivo que intercepta esse pedido
 * e decide qual função do service deve ser acionada.
 */
import { Router } from "express";
import { getInventoryData, calculateInsights, searchArtifacts } from "../services/inventory.service.js";
import { runCollection, abortCollection } from "../integrations/confluenceClient.js";
// ai.service.ts import and route have been moved to frontend

import { generateInsightsAnalysis } from "../services/ai.service.js";
import { generateExecutiveSummary } from "../services/executiveSummary.service.js";

const router = Router();

router.post("/insights/executive-summary", async (req, res) => {
  try {
    const { artifacts, term, context } = req.body;
    if (!artifacts) {
      return res.status(400).json({ error: "No artifacts sent" });
    }
    const summary = await generateExecutiveSummary(artifacts, { term, context });
    res.json(summary);
  } catch (error: any) {
    console.error(`[API] Erro no Resumo Executivo:`, error);
    res.status(500).json({ error: error.message || "Erro ao gerar resumo executivo" });
  }
});

router.post("/insights/artifacts", async (req, res) => {
  try {
    const artifacts = req.body || [];
    const analysis = await generateInsightsAnalysis(artifacts);
    res.json(analysis);
  } catch (error: any) {
    console.error("[API] Erro ao gerar insights:", error);
    res.status(500).json({ error: "Erro ao gerar insights com IA." });
  }
});

router.post("/cancel-inventory", async (req, res) => {
  console.log(`[API] POST /api/cancel-inventory - Solicitação de cancelamento recebida.`);
  try {
    await abortCollection();
    res.json({ success: true, message: "Cancelamento solicitado" });
  } catch (error: any) {
    console.error(`[API] Erro ao cancelar: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ROTA: GET /api/inventario
 * Traz todos os artefatos disponíveis de forma bruta, montando os insights gerais.
 */
router.get("/inventario", (req, res) => {
  try {
    const inventory = getInventoryData();
    res.json({
      total: inventory.length,
      resultados: inventory,
      insights: calculateInsights(inventory) // Os insights são gerados em tempo real com base na base total
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar inventário" });
  }
});

/**
 * ROTA: POST /api/update-inventory
 * Uma rota "admin" usada para disparar a atualização do banco de dados 
 * lendo diretamente do sistema Confluence.
 */
router.post("/update-inventory", async (req, res) => {
  console.log(`[API] POST /api/update-inventory - Requisição recebida.`);
  const { rootId, maxRows, username, password } = req.body;
  console.log(`[API] Parâmetros: rootId=${rootId}, maxRows=${maxRows}, username fornecido: ${!!username}`);
  
  if (!rootId) {
    console.warn(`[API] Erro: ID root da página é obrigatório`);
    return res.status(400).json({ error: "ID root da página é obrigatório" });
  }
  
  const startTime = Date.now();
  console.log(`[API] Chamando runCollection()`);
  try {
    const data = await runCollection(rootId, maxRows || null, username, password);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[API] runCollection() retornou sucesso. Quantidade: ${data.length}. Duração: ${duration}s`);
    res.json({ success: true, count: data.length });
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[API] runCollection() retornou erro após ${duration}s: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ROTA: GET /api/search?q=algumTexto
 * Responsável por filtrar os artefatos com base no parâmetro 'q' 
 * (abreviação comum para query). Retorna apenas os achados relevantes.
 */
router.get("/search", (req, res) => {
  const query = req.query.q as string || "";
  try {
    const results = searchArtifacts(query);
    res.json({
      total: results.length,
      resultados: results,
      insights: calculateInsights(results)
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar busca" });
  }
});

export default router;
