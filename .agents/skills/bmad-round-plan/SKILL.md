---
name: bmad-round-plan
description: >
  Gera um planejamento por rodadas de um projeto BMad, maximizando a paralelização de stories.
  Use esta skill sempre que o usuário pedir planejamento por rodadas, paralelização de stories,
  como distribuir stories entre agentes, quantas stories podem rodar ao mesmo tempo, ou qualquer
  variante de "quais stories posso executar em paralelo". Também deve ser usada quando o usuário
  diz "crie um plano de rodadas", "gere o round plan", "como organizar o sprint em paralelo",
  "distribuir stories entre desenvolvedores" ou perguntas sobre paralelismo no desenvolvimento.
  O artefato gerado é EXCLUSIVAMENTE para organização da equipe — nunca deve influenciar a
  implementação das stories.
---

# BMad Round Plan

**Objetivo:** Analisar o estado atual do sprint, identificar dependências técnicas entre as stories
restantes e produzir um plano de execução por rodadas que maximize a paralelização. Salvar o resultado
como um artefato de planejamento — ele é apenas para coordenação da equipe e **nunca deve ser
referenciado durante a implementação de stories**.

---

## Passo 1 — Ler o estado atual

Leia os dois arquivos:

- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status de cada story
- `_bmad-output/planning-artifacts/epics.md` — narrativa, critérios de aceitação e contexto de cada story

Se qualquer arquivo não existir, pare e informe o usuário que o projeto precisa ser inicializado
primeiro com `bmad-sprint-planning`.

---

## Passo 2 — Identificar stories restantes

No `sprint-status.yaml`, colete todas as stories cujo status **não seja** `done`.

- Ignore chaves de nível epic (ex: `epic-1`, `epic-2`) e chaves de retrospectiva.
- Para stories com status `in-progress`, `review` ou `test`, inclua-as mas marque seu status atual
  na coluna "Notas" do artefato.
- Considere as stories com status `done` como dependências já satisfeitas.

---

## Passo 3 — Construir o grafo de dependências

Para cada story restante, determine de quais outras stories ela depende lendo seus critérios de
aceitação e narrativa no `epics.md`.

**O que é uma dependência técnica dura** (a story não pode ser construída ou testada sem ela):

- Story de frontend precisa de um endpoint de API implementado em outra story
- Story usa middleware ou infraestrutura construída em outra story
- Story valida ou estende dados criados por outra story
- Story integra com um serviço ou interface definida em outra story

**O que NÃO é uma dependência técnica dura:**

- Fluxo de navegação UX ("o usuário navega de X para Y") — páginas e endpoints são independentes
- Sequência lógica preferencial ("faz mais sentido fazer X antes de Y")
- Stories do mesmo épico sem compartilhamento real de código ou API

**Trate stories já `done` como dependências satisfeitas** — elas não aparecem no grafo e não
bloqueiam nenhuma rodada.

---

## Passo 4 — Calcular as rodadas por BFS topológico

Usando busca em largura no grafo de dependências:

- **Rodada N** contém todas as stories cujas dependências estão todas satisfeitas (done ou em rodadas < N)
- Maximize stories por rodada — se uma story está desbloqueada, ela pertence à rodada atual
- Repita até alocar todas as stories restantes

---

## Passo 5 — Gerar o artefato de planejamento

Salve em `_bmad-output/planning-artifacts/round-plan.md`.

Use exatamente esta estrutura:

```markdown
# Plano de Rodadas — {nome do projeto}

> **Atenção:** Este artefato é exclusivamente para organização da equipe.
> Ele **não deve ser referenciado durante a implementação de stories**.
> Preenchimento e designação de responsáveis ocorrem externamente ao Codex.

**Gerado em:** {data atual}
**Baseado no sprint-status de:** {last_updated do sprint-status.yaml}

---

## Resumo

| Rodada | Stories | Máx. Agentes |
|--------|---------|-------------|
| 1 | X | X |
| 2 | X | X |
| ... | ... | ... |
| **Total** | **N stories** | **K rodadas** |

## Caminho Crítico

{Identifique a cadeia de dependências mais longa — ela determina o número mínimo de rodadas
independente de quantos agentes estejam disponíveis. Exemplo: "5.1 → 5.3 → 5.5 → 6.1 → 6.2"}

---

## Detalhe por Rodada

### Rodada 1 — N stories em paralelo

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| 1.6 | Login e Proteção de Rotas | (fundação do Épico 1 concluída) | |
| ... | ... | ... | ... |

### Rodada 2 — N stories em paralelo

| Story | Título | Desbloqueada por | Notas |
|-------|--------|-----------------|-------|
| ... | ... | ... | ... |

{continue para cada rodada}

---

## Grid de Designação

> Preencha esta seção externamente para designar stories a agentes ou desenvolvedores.

| Rodada | Story | Título | Responsável | Data Início | Observações |
|--------|-------|--------|-------------|-------------|-------------|
| 1 | 1.6 | Login e Proteção de Rotas | | | |
| 1 | 1.7 | Configurações da Empresa | | | |
| ... | ... | ... | | | |
```

---

## Restrições importantes

- **Nunca** modifique `sprint-status.yaml` ou qualquer arquivo de story.
- **Nunca** referencie o `round-plan.md` ao implementar stories — o artefato é somente para a equipe.
- Se uma story tiver itens TBD que exigem decisão antes da implementação (ex: biblioteca a escolher,
  provider externo), adicione uma nota na coluna "Notas" com `⚠️ TBD: {descrição}`.
- Stories com status `in-progress`, `review` ou `test` devem aparecer na Rodada 1 com seu status
  atual anotado — elas já estão em andamento e não bloqueiam o início das demais rodadas.
- O artefato gerado é um **ponto de partida** — a equipe pode reorganizá-lo externamente sem
  precisar atualizar este arquivo via Codex.
