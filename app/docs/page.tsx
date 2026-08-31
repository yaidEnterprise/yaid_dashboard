import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/api/code-block";

const apiKeyExample = `# .env do seu backend — valores fictícios, apenas ilustrativos.
# A chave real aparece uma única vez, no momento da criação do app.
YAID_API_KEY=yaid_sk_xxxxxxxxxxxxxxxxxxxxxxxx

# Toda chamada B2B autentica com o header:
#   x-api-key: $YAID_API_KEY`;

const proofRequestRequest = `# Chamada B2B, feita pelo seu backend. Valores fictícios.
curl -X POST https://<seu-dominio-yaid>/api/proof-requests \\
  -H "Authorization: Bearer 11111111-1111-4111-8111-111111111111.yaid_sk_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "proofType": "personhood",
    "externalReference": "pedido-fake-000123"
  }'`;

const proofRequestResponse = `HTTP/1.1 201 Created

{
  "id": "22222222-2222-4222-8222-222222222222",
  "appId": "11111111-1111-4111-8111-111111111111",
  "appName": "Checkout Homologação",
  "environment": "homol",
  "proofType": "personhood",
  "status": "pending_user",
  "result": null,
  "externalReference": "pedido-fake-000123",
  "createdAt": "2026-08-28T14:03:11.000Z",
  "validatedAt": null,
  "session": {
    "id": "33333333-3333-4333-8333-333333333333",
    "verificationUrl": "https://<seu-dominio-yaid>/v/<token-da-sessao>",
    "deepLinkUrl": "yaid://verify?session=<token-da-sessao>",
    "expiresAt": "2026-08-28T14:33:11.000Z"
  }
}`;

const webhookPayloadExample = `POST https://sua-aplicacao.exemplo.com/webhooks/yaid
Content-Type: application/json
X-YaID-Signature: <assinatura-ed25519-em-base64>
X-YaID-Timestamp: 1788012764

{
  "proofRequestId": "22222222-2222-4222-8222-222222222222",
  "status": "approved",
  "proofType": "personhood",
  "updatedAt": "2026-08-28T14:12:44.000Z",
  "externalReference": "pedido-fake-000123"
}`;

const webhookPublicKeyExample = `GET /api/webhook-public-key

{
  "publicKey": "<32-bytes-da-chave-publica-em-base64>",
  "algorithm": "Ed25519"
}`;

const webhookVerifyExample = `import * as ed from "@noble/ed25519";

// A assinatura cobre exatamente os bytes UTF-8 do corpo que chegou.
// Leia o corpo bruto e verifique antes de JSON.parse: reserializar o
// objeto muda espaços e ordem de chaves e invalida a assinatura.
// YAID_PUBLIC_KEY é o campo publicKey de GET /api/webhook-public-key,
// buscado uma vez e guardado na configuração da sua aplicação.
export async function handleYaidWebhook(rawBody, headers) {
  const signature = Buffer.from(headers["x-yaid-signature"], "base64");
  const publicKey = Buffer.from(YAID_PUBLIC_KEY, "base64");
  const message = Buffer.from(rawBody, "utf8");

  const authentic = await ed.verifyAsync(signature, message, publicKey);
  if (!authentic) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  // O payload não inclui um campo valid: derive o booleano do status.
  const approved = event.status === "approved";
  await liberarPedido(event.externalReference, approved);

  return new Response("ok", { status: 200 });
}`;

const requestStatuses = [
  {
    code: "pending_user",
    body: "Estado inicial, logo após o 201. A sessão existe e ninguém abriu a URL ainda.",
  },
  {
    code: "processing",
    body: "O holder abriu a sessão de verificação e o desafio criptográfico está em curso.",
  },
  {
    code: "approved",
    body: "A apresentação foi verificada com sucesso — ou aprovada manualmente em homologação. Estado terminal.",
  },
  {
    code: "rejected",
    body: "A verificação não passou: o holder cancelou a sessão ou houve reprovação manual em homologação. Estado terminal.",
  },
  {
    code: "expired",
    body: "A sessão passou de expiresAt sem conclusão. Estado terminal.",
  },
];

const sessionStatuses = [
  {
    code: "waiting_user",
    body: "Sessão criada e ainda não aberta. Corresponde à proof request em pending_user.",
  },
  {
    code: "opened",
    body: "O holder abriu a URL e recebeu o desafio. É a transição que leva a proof request para processing.",
  },
  {
    code: "approved_by_user",
    body: "O holder apresentou as credenciais e aprovou o compartilhamento. Leva a proof request para approved.",
  },
  {
    code: "cancelled",
    body: "O holder desistiu da sessão. Leva a proof request para rejected.",
  },
  {
    code: "expired",
    body: "A sessão passou do prazo de 30 minutos definido em expiresAt.",
  },
];

const flow = [
  {
    step: "01",
    title: "Criar sua conta",
    body: "Cadastro da empresa no dashboard, com CNPJ. É o que dá acesso a tudo o que vem depois.",
  },
  {
    step: "02",
    title: "Criar um app",
    body: "Cada app é um ponto de integração: tem nome, ambiente e, opcionalmente, uma URL de webhook.",
  },
  {
    step: "03",
    title: "Guardar a API key",
    body: "Gerada junto com o app e exibida uma única vez. É o que autentica sua aplicação na YaID.",
  },
  {
    step: "04",
    title: "Criar a proof request",
    body: "Seu backend chama o endpoint de verificação com a API key e recebe a sessão do holder.",
  },
  {
    step: "05",
    title: "Redirecionar o holder",
    body: "A pessoa abre a URL da sessão, apresenta suas credenciais e decide o que compartilhar.",
  },
  {
    step: "06",
    title: "Receber o webhook",
    body: "Com o resultado pronto, a YaID notifica a URL configurada no app e sua aplicação segue o fluxo.",
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-6 sm:h-16">
          <Link
            href="/"
            aria-label="Ir para a página inicial da YaID"
            className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Image
              src="/yaid_logo.svg"
              alt="YaID"
              width={63}
              height={44}
              priority
              className="h-9 w-auto object-contain sm:h-11"
            />
          </Link>
          <span className="hidden text-sm text-text-secondary sm:inline">
            Documentação de integração
          </span>

          <nav aria-label="Navegação do site" className="ml-auto flex items-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar ao site
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-5xl px-6 pb-24 pt-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-trust">
          Guia de integração
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Integre a verificação de identidade da YaID
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
          Da criação da conta ao webhook de resultado. Este guia é público: não é preciso estar
          autenticado para lê-lo, e todos os exemplos usam valores fictícios.
        </p>

        <nav
          aria-label="Navegação da documentação"
          className="mt-10 rounded-lg border border-border bg-surface p-5 shadow-card"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Nesta página
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            <li>
              <a
                href="#visao-geral"
                className="inline-flex rounded-md text-sm font-medium text-trust underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Visão geral
              </a>
            </li>
            <li>
              <a
                href="#conta-e-app"
                className="inline-flex rounded-md text-sm font-medium text-trust underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Criando sua conta e seu primeiro app
              </a>
            </li>
            <li>
              <a
                href="#ambientes"
                className="inline-flex rounded-md text-sm font-medium text-trust underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Ambientes: Homologação vs Produção
              </a>
            </li>
            <li>
              <a
                href="#proof-requests"
                className="inline-flex rounded-md text-sm font-medium text-trust underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Solicitando uma verificação (Proof Request)
              </a>
            </li>
            <li>
              <a
                href="#webhooks"
                className="inline-flex rounded-md text-sm font-medium text-trust underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Webhooks
              </a>
            </li>
          </ul>
        </nav>

        {/* ── Visão geral ─────────────────────────────────────────────── */}
        <section id="visao-geral" className="mt-16 scroll-mt-24">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Visão geral</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            A integração tem seis etapas, sempre nesta ordem. As três primeiras acontecem uma vez,
            no dashboard. As três últimas são o ciclo que sua aplicação repete a cada verificação.
          </p>

          <ol className="mt-8 border-l border-border">
            {flow.map((item) => (
              <li key={item.step} className="relative pb-8 pl-8 last:pb-0">
                <span className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface font-mono text-xs font-semibold text-trust shadow-card">
                  {item.step}
                </span>
                <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-secondary">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>

          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-text-secondary">
            A chamada da etapa 04 é um <InlineCode>POST /api/proof-requests</InlineCode> autenticado
            pelo header <InlineCode>x-api-key</InlineCode>. O contrato completo é detalhado na
            seção Solicitando uma verificação (Proof Request).
          </p>
        </section>

        {/* ── Conta e apps ────────────────────────────────────────────── */}
        <section id="conta-e-app" className="mt-16 scroll-mt-24">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            Criando sua conta e seu primeiro app
          </h2>

          <h3 className="mt-6 text-sm font-semibold text-text-primary">1. Cadastro da empresa</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            O cadastro é feito em <InlineCode>/sign-up</InlineCode> e pede quatro dados: E-mail,
            Senha, Nome da empresa e CNPJ. O e-mail informado vira o login do primeiro usuário e a
            empresa criada é a dona de todos os apps.
          </p>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">2. Criação do app</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Já autenticado, o app é criado em <InlineCode>/apps/new</InlineCode> com três campos:
            nome do app, Webhook HTTPS opcional (a URL que receberá os eventos) e ambiente
            (<InlineCode>homol</InlineCode> ou <InlineCode>prod</InlineCode>).
          </p>
          <div className="mt-4 max-w-2xl rounded-lg border border-warning-border bg-warning-bg px-4 py-3">
            <p className="text-sm leading-relaxed text-warning-text">
              A criação de apps depende da liberação da sua empresa. Enquanto a flag{" "}
              <InlineCode>can_create_apps</InlineCode> não estiver habilitada, a tela de criação
              fica indisponível e a API responde 403. Fale com o time YaID para liberar o acesso.
            </p>
          </div>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">3. API key</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Ao concluir a criação, a API key é exibida uma única vez, em um modal que só pode ser
            fechado depois que você confirmar que copiou a chave. Ela não é recuperável: se for
            perdida, o caminho é criar um novo app. Guarde-a em um gerenciador de segredos antes de
            concluir o modal.
          </p>
          <div className="mt-4 max-w-2xl">
            <CodeBlock code={apiKeyExample} language="bash" />
          </div>
        </section>

        {/* ── Ambientes ───────────────────────────────────────────────── */}
        <section id="ambientes" className="mt-16 scroll-mt-24">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            Ambientes: Homologação vs Produção
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            O ambiente é escolhido na criação do app e é imutável no MVP: para trocar, crie outro
            app. Cada app tem sua própria API key e seu próprio webhook.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-env-sandbox-border bg-env-sandbox-bg p-5">
              <h3 className="text-sm font-semibold text-env-sandbox-text">
                Homologação (<InlineCode>homol</InlineCode>)
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary">
                <li>
                  Permite Aprovar ou Reprovar uma verificação manualmente pelo dashboard, sem
                  depender de um holder real.
                </li>
                <li>
                  A decisão manual dispara o webhook real do app — o mesmo evento, na mesma URL,
                  com o mesmo formato de produção.
                </li>
                <li>Serve para você exercitar seu handler ponta a ponta antes de subir.</li>
              </ul>
            </div>

            <div className="rounded-lg border border-env-prod-border bg-env-prod-bg p-5">
              <h3 className="text-sm font-semibold text-env-prod-text">
                Produção (<InlineCode>prod</InlineCode>)
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary">
                <li>
                  Não expõe as ações manuais. O resultado depende exclusivamente do
                  fluxo real do holder, que apresenta suas credenciais na sessão de verificação.
                </li>
                <li>O webhook é disparado quando a verificação é concluída pelo holder.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 max-w-3xl rounded-lg border border-border-strong bg-surface-muted px-4 py-3">
            <p className="text-sm leading-relaxed text-text-primary">
              Importante: não há isolamento de dados entre os ambientes. Homologação não é uma
              sandbox — uma proof request é real nos dois ambientes, fica registrada na mesma base e
              consome o mesmo fluxo. A diferença está apenas em quem pode decidir o resultado.
            </p>
          </div>
        </section>

        {/* ── Proof requests (shell — detalhado na próxima entrega) ────── */}
        <section id="proof-requests" className="mt-16 scroll-mt-24">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            Solicitando uma verificação (Proof Request)
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            A proof request é o pedido de verificação que seu backend cria em{" "}
            <InlineCode>POST /api/proof-requests</InlineCode>, autenticado pela API key do app. A
            resposta traz a verificação criada e a sessão do holder, com a URL para onde a pessoa
            deve ser redirecionada.
          </p>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">
            Autenticação e requisição
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            A chamada é autenticada pela API key do app, enviada em{" "}
            <InlineCode>Authorization: Bearer</InlineCode>. O header{" "}
            <InlineCode>x-api-key</InlineCode> é aceito como forma equivalente. A chave tem o
            formato <InlineCode>&lt;uuid-do-app&gt;.&lt;segredo&gt;</InlineCode> — o app é
            identificado pela própria chave, então não é preciso mandar{" "}
            <InlineCode>appId</InlineCode> no corpo.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            O corpo tem um campo obrigatório, <InlineCode>proofType</InlineCode> (
            <InlineCode>personhood</InlineCode> ou <InlineCode>age_over_18</InlineCode>), e um
            opcional, <InlineCode>externalReference</InlineCode>: até 255 caracteres do seu lado —
            id de pedido, de cadastro, do que fizer sentido — devolvido intacto na resposta e no
            webhook.
          </p>
          <div className="mt-4">
            <CodeBlock code={proofRequestRequest} language="bash" />
          </div>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">Resposta</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            O sucesso é <InlineCode>201 Created</InlineCode>. O que interessa para o fluxo está em{" "}
            <InlineCode>session</InlineCode>: <InlineCode>verificationUrl</InlineCode> é o link para
            onde o holder deve ir, <InlineCode>deepLinkUrl</InlineCode> abre o app da carteira
            diretamente e <InlineCode>expiresAt</InlineCode> marca o fim da validade da sessão, hoje
            30 minutos após a criação.
          </p>
          <div className="mt-4">
            <CodeBlock code={proofRequestResponse} language="json" />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-secondary">
            <InlineCode>result</InlineCode> nasce <InlineCode>null</InlineCode> e{" "}
            <InlineCode>validatedAt</InlineCode> também: são preenchidos quando a verificação chega
            a um estado terminal, não no momento da criação.
          </p>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">
            Teste manual sem escrever código
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            O dashboard tem um atalho para criar a mesma proof request pela interface, em{" "}
            <InlineCode>/proof-requests/new</InlineCode>. É útil para conferir o fluxo antes de
            integrar. Esse caminho é autenticado pela sua sessão do dashboard, não pela API key, e
            por isso pede que você escolha o app na tela — é o único lugar onde{" "}
            <InlineCode>appId</InlineCode> aparece. A proof request criada é idêntica à da API.
          </p>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">Status da proof request</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            É o estado que sua aplicação acompanha. Aparece em{" "}
            <InlineCode>status</InlineCode> na resposta e no webhook.
          </p>
          <dl className="mt-4 max-w-2xl space-y-3">
            {requestStatuses.map((item) => (
              <div key={item.code} className="rounded-lg border border-border bg-surface p-4">
                <dt>
                  <InlineCode>{item.code}</InlineCode>
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-text-secondary">{item.body}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">
            Estado da sessão do holder
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            É um ciclo separado, do lado da pessoa que apresenta as credenciais. Sua aplicação não
            precisa consumi-lo, mas ele explica por que a proof request muda de estado. São dois
            conjuntos distintos de nomes — não os misture.
          </p>
          <dl className="mt-4 max-w-2xl space-y-3">
            {sessionStatuses.map((item) => (
              <div key={item.code} className="rounded-lg border border-border bg-surface p-4">
                <dt>
                  <InlineCode>{item.code}</InlineCode>
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-text-secondary">{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Webhooks (shell — detalhado na próxima entrega) ──────────── */}
        <section id="webhooks" className="mt-16 scroll-mt-24">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Webhooks</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Se o app tiver uma URL HTTPS configurada, a YaID notifica sua aplicação quando a
            verificação é concluída. É o sinal para liberar o cadastro, o pedido ou o acesso do lado
            de vocês, sem precisar ficar consultando a API.
          </p>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">O evento entregue</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            A YaID faz um <InlineCode>POST</InlineCode> na URL configurada no app, com{" "}
            <InlineCode>Content-Type: application/json</InlineCode> e mais dois headers:{" "}
            <InlineCode>X-YaID-Signature</InlineCode>, com a assinatura Ed25519 em base64, e{" "}
            <InlineCode>X-YaID-Timestamp</InlineCode>, o momento da assinatura em segundos Unix.
          </p>
          <div className="mt-4">
            <CodeBlock code={webhookPayloadExample} language="http" />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-secondary">
            <InlineCode>proofRequestId</InlineCode> é o <InlineCode>id</InlineCode> devolvido na
            criação, <InlineCode>updatedAt</InlineCode> é o instante ISO 8601 da transição e{" "}
            <InlineCode>externalReference</InlineCode> só aparece se você tiver enviado um — quando
            está ausente, a chave é omitida do JSON, não vem como{" "}
            <InlineCode>null</InlineCode>.
          </p>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">
            A chave pública de verificação
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            <InlineCode>GET /api/webhook-public-key</InlineCode> é público e devolve a chave usada
            para assinar, em base64, junto com o algoritmo. Busque uma vez e guarde em
            configuração; não é preciso consultar a cada evento.
          </p>
          <div className="mt-4">
            <CodeBlock code={webhookPublicKeyExample} language="json" />
          </div>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">
            Verificando a assinatura
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            A mensagem assinada são os bytes UTF-8 do corpo exatamente como ele chegou. Configure
            seu framework para expor o corpo bruto: se você deixar um parser JSON transformar e
            reserializar o payload, a assinatura deixa de bater mesmo sendo legítima.
          </p>
          <div className="mt-4">
            <CodeBlock code={webhookVerifyExample} language="javascript" />
          </div>
          <div className="mt-4 max-w-3xl rounded-lg border border-border-strong bg-surface-muted px-4 py-3">
            <p className="text-sm leading-relaxed text-text-primary">
              Sobre o timestamp: <InlineCode>X-YaID-Timestamp</InlineCode> serve para observabilidade
              e para você descartar eventos muito antigos se quiser, mas ele não faz parte da
              mensagem assinada. Ou seja: a assinatura prova a origem e a integridade do corpo, não a
              atualidade do envio. Se replay for uma preocupação no seu domínio, trate a
              idempotência por <InlineCode>proofRequestId</InlineCode> do seu lado.
            </p>
          </div>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">
            Quando dispara, e o que fazer se falhar
          </h3>
          <ul className="mt-2 max-w-2xl space-y-2 text-sm leading-relaxed text-text-secondary">
            <li>
              O evento é enviado nas transições terminais da proof request:{" "}
              <InlineCode>approved</InlineCode>, <InlineCode>rejected</InlineCode> e{" "}
              <InlineCode>expired</InlineCode>. Não há evento para{" "}
              <InlineCode>pending_user</InlineCode> nem <InlineCode>processing</InlineCode>.
            </li>
            <li>
              A entrega é uma tentativa só, com timeout de 10 segundos. Não há retentativa
              automática: se sua aplicação estiver fora do ar ou responder um erro, a falha é
              registrada nos logs da YaID e o evento não é reenviado.
            </li>
            <li>
              Por isso, trate o handler como caminho rápido: responda 2xx assim que validar a
              assinatura e processe o resto de forma assíncrona.
            </li>
            <li>
              Se um evento se perder, o estado continua consultável no dashboard, na tela de detalhe
              da proof request. Vale acompanhar as verificações que ficaram sem desfecho no seu lado.
            </li>
          </ul>

          <h3 className="mt-8 text-sm font-semibold text-text-primary">
            O que o webhook não carrega
          </h3>
          <div className="mt-2 max-w-3xl rounded-lg border border-border bg-surface border-l-4 border-l-privacy px-4 py-3">
            <p className="text-sm leading-relaxed text-text-primary">
              O evento não transporta credencial verificável (VC), apresentação verificável (VP),
              DID do holder, nonce nem dados pessoais. Os cinco campos do payload são tudo o que
              sai da YaID: identificador, estado, tipo de prova, horário e a sua própria
              referência. O resultado é comunicado pelo <InlineCode>status</InlineCode>; se você
              precisa de um booleano, derive-o com{" "}
              <InlineCode>status === &quot;approved&quot;</InlineCode>. Não existe um campo{" "}
              <InlineCode>valid</InlineCode> no payload — não escreva um handler que dependa dele.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <p className="text-xs text-text-tertiary">
            YaID — documentação pública de integração. Todos os exemplos desta página usam valores
            fictícios.
          </p>
        </div>
      </footer>
    </div>
  );
}
