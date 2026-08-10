---
storyId: 1-7
title: Configurações da Empresa
epic: 1
status: in-progress
startedAt: '2026-05-13'
---

# Story 1.7: Configurações da Empresa

> 📋 **Referência UX:** `ux-design-specification.md` — seções "Form Patterns" (cards de configuração segmentados, botões Salvar/Cancelar), "Modal Patterns" (AlertDialog para logout — ação destrutiva com confirmação), "Feedback Patterns" (toast de sucesso/erro, permanecer na página após salvar) e "Navigation Patterns" (redirects pós-ação).

Como empresa parceira autenticada,
Quero visualizar e editar os dados da minha empresa e fazer logout com confirmação,
Para que eu mantenha minha conta atualizada e não saia acidentalmente do sistema.

## Acceptance Criteria

**Given** a página `/settings` para um usuário autenticado
**When** a página carrega
**Then** os dados da company (nome, CNPJ) são exibidos nos campos, alimentados por `GET /api/companies/me`
**And** o endpoint retorna `{ id, name, cnpj, status, createdAt }` em camelCase
**And** um card visual de Stripe é exibido como placeholder (não funcional, sem chamada a API externa)

**Given** o formulário de settings com dados alterados
**When** o usuário clica em salvar
**Then** `PATCH /api/companies/me` é chamado com os campos alterados
**And** o botão fica `disabled` durante o envio
**And** em caso de sucesso, um toast de sucesso é exibido e os campos refletem os novos valores
**And** em caso de erro, um toast de erro é exibido sem perder os valores digitados

**Given** o botão de logout na página de settings
**When** o usuário clica em logout
**Then** um dialog de confirmação é exibido com as opções "Cancelar" e "Sair"
**And** ao confirmar, `POST /api/auth/sign-out` é chamado e o usuário é redirecionado para `/sign-in`
**And** ao cancelar, o dialog fecha e o usuário permanece na página

## Implementation Notes

### Backend
- `GET /api/companies/me` já existe — ajustar viewmodel para retornar campo `cnpj` (alias de `documentNumber`)
- Novo: `PATCH /api/companies/me` — UpdateMyCompanyUseCase + Controller + Presenter
- Novo: método `update(company)` em `CompanyRepository` e `SupabaseCompanyRepository`

### Frontend
- Settings page reescrita com React Hook Form + Zod
- AlertDialog de logout implementado nativamente (sem lib externa)
- `fetchWithAuth` para PATCH; `fetch` simples para sign-out
