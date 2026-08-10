---
name: feedback-no-qr-code-mvp
description: A tela coringa do yaid_dashboard NÃO tem QR code no MVP — apenas botão de deep link
metadata:
  type: feedback
---

A tela coringa (`/v/[sessionToken]`) exibe apenas um botão de deep link (`yaid://verify?session=<token>`) no MVP. **Sem QR code.**

**Why:** Esta decisão foi tomada no escopo do MVP e reforçada múltiplas vezes pelo usuário. Está documentada na arquitetura e nos épicos. QR code é roadmap pós-MVP.

**How to apply:** Em qualquer menção à tela coringa — UX specs, implementação, descrições de fluxo — nunca incluir QR code como feature do MVP. Se o contexto for pós-MVP, deixar explícito.
