---
title: 'Remoção do texto "YaID" ao lado do ícone'
type: 'chore'
created: '2026-08-04'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Em todas as telas com o ícone da marca (login, cadastro e sidebar do dashboard), o texto "YaID" — e no sidebar também "Business Console" — aparecia ao lado do ícone, duplicando informação desnecessária e ocupando espaço.

**Approach:** Remover os elementos `<span>` com o texto da marca ao lado do ícone nas três superfícies afetadas.

## Suggested Review Order

- [`app/sign-in/page.tsx:83`](../../app/sign-in/page.tsx) — remoção do `<span>YaID</span>` e do `gap-3` no container do logo
- [`app/sign-up/page.tsx:126`](../../app/sign-up/page.tsx) — mesmo padrão de remoção
- [`components/layout/app-sidebar.tsx:49`](../../components/layout/app-sidebar.tsx) — remoção do bloco condicional com "YaID" e "Business Console"
