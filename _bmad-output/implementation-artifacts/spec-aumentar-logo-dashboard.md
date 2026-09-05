---
title: 'Aumentar logo do dashboard'
type: 'chore'
created: '2026-08-11'
status: 'done'
route: 'one-shot'
---

# Aumentar logo do dashboard

## Intent

**Problem:** O logo YaID exibido no cabeçalho da sidebar do dashboard estava visualmente pequeno.

**Approach:** Aumentar somente a imagem de 16×16 para 24×24, preservando o contêiner, a proporção e o comportamento responsivo existente.

## Suggested Review Order

- A dimensão maior melhora a presença da marca sem alterar o layout da sidebar.
  [`app-sidebar.tsx:51`](../../components/layout/app-sidebar.tsx#L51)
