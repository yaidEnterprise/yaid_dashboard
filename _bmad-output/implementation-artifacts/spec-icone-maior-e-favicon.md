---
title: 'Ícone maior e favicon na aba do browser'
type: 'chore'
created: '2026-08-05'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** O ícone YaID aparecia em tamanho pequeno nas telas (metade do container) e o browser não exibia a logo na aba por falta de favicon configurado.

**Approach:** Aumentar o tamanho CSS do ícone para preencher o container em todas as superfícies; adicionar `yaid_favicon.svg` (com suporte a `prefers-color-scheme: dark`) e referenciá-lo via metadata do Next.js.

## Suggested Review Order

- [`app/layout.tsx:15`](../../app/layout.tsx) — metadata com `icons.icon` apontando para o SVG favicon
- [`public/yaid_favicon.svg`](../../public/yaid_favicon.svg) — SVG do favicon com `<style>` de dark mode embutido
- [`app/sign-in/page.tsx:84`](../../app/sign-in/page.tsx) — container `h-12 w-12`, imagem `h-12 w-12 width={48}`
- [`app/sign-up/page.tsx:126`](../../app/sign-up/page.tsx) — mesmo padrão do sign-in
- [`components/layout/app-sidebar.tsx:50`](../../components/layout/app-sidebar.tsx) — imagem `h-8 w-8 width={32}` preenchendo o container
- [`components/verification/verification-layout.tsx:11`](../../components/verification/verification-layout.tsx) — imagem `h-9 w-9 width={36}`, texto "YaID" removido
