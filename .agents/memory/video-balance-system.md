---
name: Video balance system
description: Arquitetura do saldo de vídeos não-expirante — tabelas, webhook, rotas e regras de consumo.
---

## Regras fundamentais

- `videoBalance` fica em `users.videoBalance` (integer, não-expira, não reseta com plano)
- Compras registradas em `video_transactions` (tabela separada de `credits_transactions`)
- Idempotência do webhook usa `videoTransactions.stripeSessionId` — NÃO `creditsTransactions`
- Webhook lê `meta.videos` (count de vídeos) para video_pack — diferente de `meta.amount` usado em credit/creative packs
- Consumo via `POST /api/videos/use` (deducts 1, registra em videoTransactions)
- `POST /api/videos/use` exige `requirePlan(["pro","business","agency"])` — FREE bloqueado
- Checkout em `/api/stripe/videos/checkout` também exige `requirePlan(["pro","business","agency"])`
- FREE user clica em comprar vídeo → abre PlanComparisonModal (setShowComparison(true))

**Why:** Vídeos são recurso premium high-cost (HeyGen API), devem ser comprados separadamente e nunca misturados com créditos gerais ou criativos.

## Fluxo de consumo

1. Frontend busca `GET /api/videos/balance` no mount (Billing + CreativeGenerator)
2. Gate visual aparece em CreativeGenerator se `videoBalance === 0`
3. `runVideoGenerate` aguarda SSE completion → se resultado não-null → `POST /api/videos/use`
4. `setVideoBalance(data.newBalance)` atualiza contador local sem re-fetch

## Diretriz arquitetural futura (registrada)

Central de Créditos deve exibir separadamente:
- Créditos do Plano / Créditos Avulsos
- Criativos do Plano / Criativos Avulsos
- Vídeos / Histórico / Compras / Consumo

Regra de consumo validada: plano primeiro, avulso depois.
