# Guia de Arquitetura para Rotas Backend em Next.js

## 1. Objetivo

Este documento define um padrão escalável para criação, manutenção e evolução de rotas backend em projetos Next.js usando Route Handlers.

O foco é exclusivamente a camada backend da aplicação.

Este guia deve ser seguido por agentes de IA ao criar novas rotas, alterar rotas existentes, organizar módulos, implementar casos de uso, conectar infraestrutura e manter os contratos HTTP consistentes.

---

## 2. Princípio Geral

No Next.js, as rotas backend ficam dentro de:

src/app/api

Cada endpoint deve possuir um arquivo:

route.ts

Exemplo:

src/app/api/verifications/route.ts

Esse arquivo representa o endpoint:

POST /api/verifications
GET /api/verifications

Apesar disso, o arquivo route.ts deve ser uma camada fina de adaptação HTTP.

Ele não deve concentrar regra de negócio, acesso direto ao banco de dados, integração direta com serviços externos ou lógica de domínio.

A cadeia recomendada é:

Route Handler
  -> Controller
    -> Use Case
      -> Domain
      -> Repository Interface
        -> Repository Implementation
          -> Database / External Service

---

## 3. Estrutura Backend Recomendada

A estrutura backend recomendada é:

src/
  app/
    api/
      verifications/
        route.ts
        [verificationId]/
          route.ts
          submit-proof/
            route.ts
          approve/
            route.ts
          reject/
            route.ts

      companies/
        route.ts
        [companyId]/
          route.ts

      proof-sessions/
        route.ts
        [sessionId]/
          route.ts

      blockchain/
        commitments/
          route.ts
          [commitmentId]/
            route.ts

  modules/
    verification/
      domain/
        entities/
        enums/
        repositories/
        services/

      application/
        dtos/
        usecases/

      infra/
        repositories/
        services/
        mappers/

      presentation/
        controllers/
        validators/

      factories/

    company/
      domain/
        entities/
        enums/
        repositories/

      application/
        dtos/
        usecases/

      infra/
        repositories/
        mappers/

      presentation/
        controllers/
        validators/

      factories/

  shared/
    config/
    errors/
    http/
    types/
    utils/

  lib/
    database/
    supabase/
    blockchain/
    ocr/
    storage/

---

## 4. Responsabilidade do route.ts

O arquivo route.ts deve apenas adaptar o protocolo HTTP para a aplicação.

Ele pode:

- receber a requisição;
- ler body, params e query params;
- chamar uma factory;
- chamar um controller;
- retornar NextResponse;
- capturar erros;
- converter erros em respostas HTTP;
- expor métodos GET, POST, PUT, PATCH e DELETE.

Ele não deve:

- conter regra de negócio;
- acessar banco diretamente;
- chamar SDKs externos diretamente;
- validar manualmente muitos campos;
- montar várias dependências diretamente;
- criar entidades complexas diretamente;
- decidir regras de aprovação, rejeição ou processamento;
- conter lógica de domínio;
- importar variáveis de ambiente sensíveis diretamente;
- conhecer detalhes internos de Supabase, Prisma, blockchain, OCR ou storage.

Exemplo correto:

import { NextRequest, NextResponse } from "next/server";
import { makeCreateVerificationController } from "@/modules/verification/factories/makeCreateVerificationController";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const controller = makeCreateVerificationController();

    const result = await controller.handle(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}

Exemplo incorreto:

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.companyId) {
    return NextResponse.json(
      { error: "companyId is required" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const verification = {
    id: crypto.randomUUID(),
    company_id: body.companyId,
    status: "PENDING",
    type: body.type,
    created_at: new Date().toISOString(),
  };

  await supabase.from("verifications").insert(verification);

  return NextResponse.json(verification, { status: 201 });
}

O exemplo incorreto mistura:

- HTTP;
- validação;
- regra de negócio;
- persistência;
- configuração de ambiente;
- criação de entidade;
- resposta da API.

---

## 5. Convenção para Criação de Rotas

As rotas devem ser organizadas por recurso.

Exemplos:

src/app/api/companies/route.ts
src/app/api/companies/[companyId]/route.ts

src/app/api/verifications/route.ts
src/app/api/verifications/[verificationId]/route.ts
src/app/api/verifications/[verificationId]/submit-proof/route.ts

src/app/api/proof-sessions/route.ts
src/app/api/proof-sessions/[sessionId]/route.ts

src/app/api/blockchain/commitments/route.ts
src/app/api/blockchain/commitments/[commitmentId]/route.ts

---

## 6. Nome dos Endpoints

Preferir endpoints orientados a recursos.

Bom:

POST /api/verifications
GET /api/verifications
GET /api/verifications/{verificationId}
PATCH /api/verifications/{verificationId}
POST /api/verifications/{verificationId}/submit-proof

Evitar endpoints excessivamente verbais quando uma modelagem por recurso for suficiente.

Evitar:

POST /api/createVerification
POST /api/getVerification
POST /api/updateVerificationStatus

Exceções são aceitáveis quando a rota representa uma ação clara sobre um recurso.

Aceitável:

POST /api/verifications/{verificationId}/submit-proof
POST /api/verifications/{verificationId}/approve
POST /api/verifications/{verificationId}/reject
POST /api/proof-sessions/{sessionId}/complete
POST /api/blockchain/commitments/{commitmentId}/anchor

---

## 7. Organização por Módulo

Cada domínio funcional da aplicação deve possuir seu próprio módulo.

Exemplos de módulos:

modules/
  company/
  verification/
  proof-session/
  blockchain/
  identity/
  document/
  webhook/

Cada módulo deve seguir a mesma estrutura interna:

modules/[module-name]/
  domain/
  application/
  infra/
  presentation/
  factories/

Essa padronização permite que agentes de IA encontrem rapidamente onde criar ou alterar arquivos.

---

## 8. Camada Domain

A camada domain contém o núcleo conceitual do módulo.

Local:

src/modules/[module-name]/domain

Ela deve conter:

- entidades;
- value objects;
- enums;
- interfaces de repositórios;
- interfaces de serviços;
- regras puras de domínio.

Exemplo:

src/modules/verification/domain/
  entities/
    Verification.ts
  enums/
    VerificationStatus.ts
    VerificationType.ts
  repositories/
    VerificationRepository.ts
  services/
    ProofValidator.ts

---

## 9. Entidades

Entidades representam objetos centrais do domínio.

Exemplo:

src/modules/verification/domain/entities/Verification.ts

import { VerificationStatus } from "../enums/VerificationStatus";
import { VerificationType } from "../enums/VerificationType";

type VerificationProps = {
  id: string;
  companyId: string;
  type: VerificationType;
  status: VerificationStatus;
  createdAt: Date;
  expiresAt: Date;
};

export class Verification {
  private props: VerificationProps;

  constructor(props: VerificationProps) {
    this.props = props;
  }

  get id() {
    return this.props.id;
  }

  get companyId() {
    return this.props.companyId;
  }

  get type() {
    return this.props.type;
  }

  get status() {
    return this.props.status;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get expiresAt() {
    return this.props.expiresAt;
  }

  approve() {
    if (this.props.status !== VerificationStatus.PENDING) {
      throw new Error("Only pending verifications can be approved");
    }

    this.props.status = VerificationStatus.APPROVED;
  }

  reject() {
    if (this.props.status !== VerificationStatus.PENDING) {
      throw new Error("Only pending verifications can be rejected");
    }

    this.props.status = VerificationStatus.REJECTED;
  }

  expire() {
    this.props.status = VerificationStatus.EXPIRED;
  }
}

---

## 10. Enums

Enums devem ficar dentro do domínio quando representam estados ou tipos próprios do negócio.

Exemplo:

src/modules/verification/domain/enums/VerificationStatus.ts

export enum VerificationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

Exemplo:

src/modules/verification/domain/enums/VerificationType.ts

export enum VerificationType {
  PERSONHOOD = "PERSONHOOD",
  AGE_OVER_18 = "AGE_OVER_18",
}

---

## 11. Interfaces de Repositório

Interfaces de repositório devem ficar no domínio.

Elas definem o que o domínio precisa, sem definir como será implementado.

Exemplo:

src/modules/verification/domain/repositories/VerificationRepository.ts

import { Verification } from "../entities/Verification";

export interface VerificationRepository {
  create(verification: Verification): Promise<void>;
  findById(id: string): Promise<Verification | null>;
  update(verification: Verification): Promise<void>;
  listByCompanyId(companyId: string): Promise<Verification[]>;
}

Regra:

O domínio define o contrato.
A infraestrutura implementa o contrato.

---

## 12. Camada Application

A camada application contém os casos de uso da aplicação.

Local:

src/modules/[module-name]/application

Ela deve conter:

- use cases;
- DTOs;
- schemas de entrada, quando fizer sentido;
- orquestração de repositórios e serviços;
- regras de aplicação.

Ela não deve depender diretamente de Supabase, Prisma, blockchain, OCR, storage ou APIs externas.

Ela deve depender de interfaces.

Exemplo:

src/modules/verification/application/
  dtos/
    CreateVerificationDTO.ts
    SubmitProofDTO.ts
  usecases/
    CreateVerificationUseCase.ts
    SubmitProofUseCase.ts
    GetVerificationUseCase.ts
    ListVerificationsUseCase.ts

---

## 13. DTOs

DTOs definem os dados de entrada e saída dos casos de uso.

Exemplo:

src/modules/verification/application/dtos/CreateVerificationDTO.ts

import { z } from "zod";

export const CreateVerificationSchema = z.object({
  companyId: z.string().uuid(),
  type: z.enum(["PERSONHOOD", "AGE_OVER_18"]),
});

export type CreateVerificationDTO = z.infer<typeof CreateVerificationSchema>;

Exemplo de DTO de saída:

export type CreateVerificationOutputDTO = {
  id: string;
  companyId: string;
  type: "PERSONHOOD" | "AGE_OVER_18";
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
};

---

## 14. Use Cases

Use cases executam a regra de aplicação.

Exemplo:

src/modules/verification/application/usecases/CreateVerificationUseCase.ts

import { Verification } from "../../domain/entities/Verification";
import { VerificationRepository } from "../../domain/repositories/VerificationRepository";
import { VerificationStatus } from "../../domain/enums/VerificationStatus";
import { VerificationType } from "../../domain/enums/VerificationType";
import {
  CreateVerificationDTO,
  CreateVerificationOutputDTO,
} from "../dtos/CreateVerificationDTO";

export class CreateVerificationUseCase {
  constructor(
    private readonly verificationRepository: VerificationRepository
  ) {}

  async execute(input: CreateVerificationDTO): Promise<CreateVerificationOutputDTO> {
    const now = new Date();

    const expiresAt = new Date(now);
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const verification = new Verification({
      id: crypto.randomUUID(),
      companyId: input.companyId,
      type: input.type as VerificationType,
      status: VerificationStatus.PENDING,
      createdAt: now,
      expiresAt,
    });

    await this.verificationRepository.create(verification);

    return {
      id: verification.id,
      companyId: verification.companyId,
      type: verification.type,
      status: verification.status,
      createdAt: verification.createdAt.toISOString(),
      expiresAt: verification.expiresAt.toISOString(),
    };
  }
}

Regras:

- use cases podem criar entidades;
- use cases podem chamar repositórios;
- use cases podem chamar serviços de domínio;
- use cases podem orquestrar fluxos;
- use cases não devem conhecer detalhes concretos de banco ou SDK externo.

---

## 15. Camada Infra

A camada infra contém implementações concretas de interfaces.

Local:

src/modules/[module-name]/infra

Ela pode conter:

- repositórios Supabase;
- repositórios Prisma;
- integrações com blockchain;
- serviços de OCR;
- serviços de e-mail;
- storage;
- mensageria;
- mappers entre banco e domínio.

Exemplo:

src/modules/verification/infra/
  repositories/
    SupabaseVerificationRepository.ts
  mappers/
    VerificationMapper.ts
  services/
    EthersCommitmentRegistry.ts

---

## 16. Repository Implementation

Exemplo:

src/modules/verification/infra/repositories/SupabaseVerificationRepository.ts

import { Verification } from "../../domain/entities/Verification";
import { VerificationRepository } from "../../domain/repositories/VerificationRepository";
import { VerificationMapper } from "../mappers/VerificationMapper";
import { supabaseServerClient } from "@/lib/supabase/server";

export class SupabaseVerificationRepository implements VerificationRepository {
  async create(verification: Verification): Promise<void> {
    const persistence = VerificationMapper.toPersistence(verification);

    const { error } = await supabaseServerClient
      .from("verifications")
      .insert(persistence);

    if (error) {
      throw error;
    }
  }

  async findById(id: string): Promise<Verification | null> {
    const { data, error } = await supabaseServerClient
      .from("verifications")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return VerificationMapper.toDomain(data);
  }

  async update(verification: Verification): Promise<void> {
    const persistence = VerificationMapper.toPersistence(verification);

    const { error } = await supabaseServerClient
      .from("verifications")
      .update(persistence)
      .eq("id", verification.id);

    if (error) {
      throw error;
    }
  }

  async listByCompanyId(companyId: string): Promise<Verification[]> {
    const { data, error } = await supabaseServerClient
      .from("verifications")
      .select("*")
      .eq("company_id", companyId);

    if (error || !data) {
      return [];
    }

    return data.map(VerificationMapper.toDomain);
  }
}

---

## 17. Mappers

Mappers convertem dados entre formatos diferentes.

Exemplo:

- banco de dados para entidade;
- entidade para banco de dados;
- entidade para resposta HTTP;
- payload externo para DTO interno.

Local recomendado:

src/modules/[module-name]/infra/mappers

Exemplo:

src/modules/verification/infra/mappers/VerificationMapper.ts

import { Verification } from "../../domain/entities/Verification";
import { VerificationStatus } from "../../domain/enums/VerificationStatus";
import { VerificationType } from "../../domain/enums/VerificationType";

type VerificationPersistence = {
  id: string;
  company_id: string;
  type: string;
  status: string;
  created_at: string;
  expires_at: string;
};

export class VerificationMapper {
  static toDomain(raw: VerificationPersistence): Verification {
    return new Verification({
      id: raw.id,
      companyId: raw.company_id,
      type: raw.type as VerificationType,
      status: raw.status as VerificationStatus,
      createdAt: new Date(raw.created_at),
      expiresAt: new Date(raw.expires_at),
    });
  }

  static toPersistence(verification: Verification): VerificationPersistence {
    return {
      id: verification.id,
      company_id: verification.companyId,
      type: verification.type,
      status: verification.status,
      created_at: verification.createdAt.toISOString(),
      expires_at: verification.expiresAt.toISOString(),
    };
  }
}

---

## 18. Camada Presentation

A camada presentation contém os controllers e validadores usados pelas rotas HTTP.

Local:

src/modules/[module-name]/presentation

Exemplo:

src/modules/verification/presentation/
  controllers/
    CreateVerificationController.ts
    GetVerificationController.ts
    SubmitProofController.ts
  validators/
    createVerificationValidator.ts

---

## 19. Controllers

Controllers adaptam entrada externa para casos de uso.

Eles devem:

- receber body, params ou query;
- validar entrada;
- chamar o use case;
- retornar um objeto serializável;
- não retornar NextResponse diretamente;
- não conhecer detalhes de banco;
- não conhecer detalhes de SDK externo.

Exemplo:

src/modules/verification/presentation/controllers/CreateVerificationController.ts

import { CreateVerificationUseCase } from "../../application/usecases/CreateVerificationUseCase";
import { CreateVerificationSchema } from "../../application/dtos/CreateVerificationDTO";

export class CreateVerificationController {
  constructor(
    private readonly createVerificationUseCase: CreateVerificationUseCase
  ) {}

  async handle(body: unknown) {
    const input = CreateVerificationSchema.parse(body);

    return await this.createVerificationUseCase.execute(input);
  }
}

---

## 20. Factories

Factories montam as dependências concretas.

Local:

src/modules/[module-name]/factories

Exemplo:

src/modules/verification/factories/makeCreateVerificationController.ts

import { CreateVerificationUseCase } from "../application/usecases/CreateVerificationUseCase";
import { SupabaseVerificationRepository } from "../infra/repositories/SupabaseVerificationRepository";
import { CreateVerificationController } from "../presentation/controllers/CreateVerificationController";

export function makeCreateVerificationController() {
  const verificationRepository = new SupabaseVerificationRepository();

  const createVerificationUseCase = new CreateVerificationUseCase(
    verificationRepository
  );

  const createVerificationController = new CreateVerificationController(
    createVerificationUseCase
  );

  return createVerificationController;
}

Regras:

- route.ts chama factory;
- factory instancia implementação concreta;
- use case recebe interfaces;
- controller recebe use case;
- infra fica isolada.

---

## 21. Tratamento Padronizado de Erros

Erros devem ser tratados de forma centralizada.

Local:

src/shared/errors/AppError.ts
src/shared/http/handleHttpError.ts

Exemplo:

src/shared/errors/AppError.ts

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = "APP_ERROR"
  ) {
    super(message);
  }
}

Exemplo:

src/shared/http/handleHttpError.ts

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";

export function handleHttpError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          issues: error.issues,
        },
      },
      { status: 400 }
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    },
    { status: 500 }
  );
}

Uso no route.ts:

import { NextRequest, NextResponse } from "next/server";
import { makeCreateVerificationController } from "@/modules/verification/factories/makeCreateVerificationController";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const controller = makeCreateVerificationController();

    const result = await controller.handle(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}

---

## 22. Variáveis de Ambiente

As variáveis de ambiente devem ser centralizadas.

Local:

src/shared/config/env.ts

Exemplo:

import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  RPC_URL: z.string().url().optional(),
  COMMITMENT_REGISTRY_ADDRESS: z.string().optional(),

  OCR_PROVIDER_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

Regras:

- variáveis privadas não devem usar NEXT_PUBLIC_;
- variáveis públicas devem usar NEXT_PUBLIC_;
- secrets nunca devem ser importados em código client-side;
- repositórios e serviços concretos podem usar env;
- entidades e use cases não devem depender diretamente de process.env.

---

## 23. Pasta lib

A pasta lib deve conter inicialização de SDKs e clients técnicos.

Exemplo:

src/lib/
  supabase/
    server.ts
  blockchain/
    provider.ts
  ocr/
    client.ts
  storage/
    s3.ts

Exemplo:

src/lib/supabase/server.ts

import { createClient } from "@supabase/supabase-js";
import { env } from "@/shared/config/env";

export const supabaseServerClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

Regra:

lib contém clients técnicos.
infra usa clients técnicos.
application não usa lib diretamente.
domain não usa lib diretamente.

---

## 24. Contrato de Resposta das APIs

Toda API deve responder em formato previsível.

Resposta de sucesso para criação:

{
  "id": "uuid",
  "companyId": "uuid",
  "type": "PERSONHOOD",
  "status": "PENDING",
  "createdAt": "2026-05-04T10:00:00.000Z",
  "expiresAt": "2026-05-04T10:15:00.000Z"
}

Resposta de erro:

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "issues": []
  }
}

Resposta de erro de domínio:

{
  "error": {
    "code": "VERIFICATION_NOT_FOUND",
    "message": "Verification not found"
  }
}

---

## 25. Padrão para Métodos HTTP

Usar os métodos HTTP da seguinte forma:

GET:
- buscar um recurso;
- listar recursos;
- não alterar estado.

POST:
- criar recurso;
- executar ação que cria ou dispara processamento.

PUT:
- substituir um recurso inteiro.

PATCH:
- atualizar parcialmente um recurso.

DELETE:
- remover, cancelar ou desativar recurso.

Exemplos:

POST /api/verifications
GET /api/verifications
GET /api/verifications/{verificationId}
PATCH /api/verifications/{verificationId}
DELETE /api/verifications/{verificationId}

POST /api/verifications/{verificationId}/submit-proof
POST /api/verifications/{verificationId}/approve
POST /api/verifications/{verificationId}/reject

---

## 26. Params em Rotas Dinâmicas

Rotas dinâmicas devem usar pastas com colchetes.

Exemplo:

src/app/api/verifications/[verificationId]/route.ts

Exemplo de uso:

import { NextRequest, NextResponse } from "next/server";
import { makeGetVerificationController } from "@/modules/verification/factories/makeGetVerificationController";
import { handleHttpError } from "@/shared/http/handleHttpError";

type Params = {
  params: Promise<{
    verificationId: string;
  }>;
};

export async function GET(req: NextRequest, context: Params) {
  try {
    const { verificationId } = await context.params;

    const controller = makeGetVerificationController();

    const result = await controller.handle({
      verificationId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}

Observação:

Em versões recentes do Next.js, params pode ser assíncrono dependendo da configuração e versão utilizada. Ao criar rotas novas, verificar o padrão do projeto e manter consistência com as rotas existentes.

---

## 27. Query Params

Query params devem ser lidos no route.ts e enviados ao controller como objeto simples.

Exemplo:

GET /api/verifications?companyId=123&status=PENDING

import { NextRequest, NextResponse } from "next/server";
import { makeListVerificationsController } from "@/modules/verification/factories/makeListVerificationsController";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const controller = makeListVerificationsController();

    const result = await controller.handle({
      companyId: searchParams.get("companyId"),
      status: searchParams.get("status"),
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleHttpError(error);
  }
}

A validação dos query params deve acontecer no controller ou em schema específico.

---

## 28. Validação de Entrada

Toda entrada externa deve ser validada.

Entradas externas incluem:

- body;
- params;
- query params;
- headers;
- payloads de webhook.

Preferir Zod.

Exemplo:

import { z } from "zod";

export const GetVerificationSchema = z.object({
  verificationId: z.string().uuid(),
});

export type GetVerificationDTO = z.infer<typeof GetVerificationSchema>;

Uso:

const input = GetVerificationSchema.parse({
  verificationId,
});

---

## 29. Autenticação e Autorização

A autenticação deve ser tratada de forma padronizada.

Sugestão de locais:

src/shared/http/getAuthenticatedUser.ts
src/shared/http/requireAuthenticatedUser.ts
src/shared/http/requireCompanyAccess.ts

Exemplo:

src/shared/http/requireAuthenticatedUser.ts

import { AppError } from "../errors/AppError";

export async function requireAuthenticatedUser(req: Request) {
  const authorization = req.headers.get("authorization");

  if (!authorization) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const token = authorization.replace("Bearer ", "");

  if (!token) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return {
    id: "user-id",
    token,
  };
}

Uso no route.ts:

const user = await requireAuthenticatedUser(req);

const result = await controller.handle({
  userId: user.id,
  body,
});

Regra:

- autenticação pode ser lida no route.ts ou em middleware;
- autorização de regra de negócio deve ficar em use case;
- validação de permissão específica deve ser clara e testável.

---

## 30. Middleware

Middleware pode ser usado para regras globais.

Exemplos:

- autenticação global;
- logging;
- correlação de request;
- proteção de rotas internas;
- rate limiting básico.

Arquivo:

src/middleware.ts

Usar middleware com cautela.

Evitar colocar regra de negócio dentro do middleware.

---

## 31. CORS

Quando o backend for consumido por aplicações externas, como Expo, parceiros ou outros sistemas, as rotas devem tratar CORS quando necessário.

Preferir uma função compartilhada para headers.

Exemplo:

src/shared/http/cors.ts

export function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

Exemplo de OPTIONS:

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/shared/http/cors";

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: getCorsHeaders(),
    }
  );
}

Exemplo em POST:

return NextResponse.json(result, {
  status: 201,
  headers: getCorsHeaders(),
});

---

## 32. Integrações Externas

Integrações externas devem ficar na camada infra.

Exemplos:

- Supabase;
- Prisma;
- blockchain;
- OCR;
- storage;
- e-mail;
- APIs de terceiros;
- filas;
- webhooks.

Nunca chamar essas integrações diretamente no route.ts.

Fluxo correto:

route.ts
  -> controller
    -> use case
      -> service interface
        -> infra service implementation
          -> external SDK

---

## 33. Exemplo com Serviço Externo

Interface no domínio:

src/modules/document/domain/services/DocumentReader.ts

export type ExtractedDocumentData = {
  fullName: string;
  cpf?: string;
  birthDate?: string;
};

export interface DocumentReader {
  extractFromImage(input: {
    imageUrl: string;
  }): Promise<ExtractedDocumentData>;
}

Implementação na infra:

src/modules/document/infra/services/OcrDocumentReader.ts

import { DocumentReader } from "../../domain/services/DocumentReader";

export class OcrDocumentReader implements DocumentReader {
  async extractFromImage(input: { imageUrl: string }) {
    return {
      fullName: "Example Name",
      cpf: "00000000000",
      birthDate: "2000-01-01",
    };
  }
}

Use case:

src/modules/document/application/usecases/ExtractDocumentDataUseCase.ts

import { DocumentReader } from "../../domain/services/DocumentReader";

export class ExtractDocumentDataUseCase {
  constructor(
    private readonly documentReader: DocumentReader
  ) {}

  async execute(input: { imageUrl: string }) {
    return await this.documentReader.extractFromImage({
      imageUrl: input.imageUrl,
    });
  }
}

Factory:

src/modules/document/factories/makeExtractDocumentDataController.ts

import { OcrDocumentReader } from "../infra/services/OcrDocumentReader";
import { ExtractDocumentDataUseCase } from "../application/usecases/ExtractDocumentDataUseCase";
import { ExtractDocumentDataController } from "../presentation/controllers/ExtractDocumentDataController";

export function makeExtractDocumentDataController() {
  const documentReader = new OcrDocumentReader();

  const useCase = new ExtractDocumentDataUseCase(documentReader);

  return new ExtractDocumentDataController(useCase);
}

---

## 34. Webhooks

Webhooks devem ser tratados como rotas backend normais, mas com atenção especial a:

- validação de assinatura;
- idempotência;
- logs;
- controle de repetição;
- status HTTP correto;
- armazenamento do evento recebido.

Exemplo de rota:

src/app/api/webhooks/payment/route.ts

Fluxo recomendado:

Route Handler
  -> lê payload bruto, se necessário
  -> valida assinatura
  -> chama controller
  -> controller chama use case
  -> use case processa evento
  -> retorna status

A validação criptográfica da assinatura pode ficar em um serviço de infra ou shared, dependendo do caso.

---

## 35. Idempotência

Rotas que podem receber repetição de eventos devem ser idempotentes.

Exemplos:

- webhooks;
- confirmação de pagamento;
- callback de OCR;
- callback de blockchain;
- submissão de prova;
- criação de sessão via integração externa.

Estratégias:

- usar externalEventId;
- usar idempotencyKey;
- verificar se recurso já foi processado;
- salvar status de processamento;
- ignorar eventos duplicados com segurança.

Exemplo de entrada:

{
  "idempotencyKey": "partner-id:event-id",
  "payload": {}
}

---

## 36. Paginação

Rotas de listagem devem suportar paginação.

Exemplo:

GET /api/verifications?page=1&limit=20

Resposta recomendada:

{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}

DTO:

import { z } from "zod";

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

---

## 37. Filtros

Filtros devem ser passados por query params.

Exemplo:

GET /api/verifications?companyId=uuid&status=PENDING&type=PERSONHOOD

Validação:

import { z } from "zod";

export const ListVerificationsSchema = z.object({
  companyId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]).optional(),
  type: z.enum(["PERSONHOOD", "AGE_OVER_18"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

---

## 38. Upload de Arquivos

Rotas de upload devem ser separadas das rotas de processamento quando possível.

Exemplo:

POST /api/uploads/document-image
POST /api/documents/extract
POST /api/verifications/{verificationId}/submit-document

O upload deve cuidar de:

- validação de tipo de arquivo;
- limite de tamanho;
- armazenamento;
- retorno da URL ou chave do arquivo.

O processamento deve cuidar de:

- extrair informações;
- validar documento;
- associar com uma verificação;
- atualizar status.

Evitar misturar upload, OCR, validação e persistência complexa em uma única rota sem necessidade.

---

## 39. Status HTTP Recomendados

Usar status HTTP de forma consistente.

200 OK:
- operação concluída com sucesso;
- leitura de dados;
- atualização com retorno.

201 Created:
- recurso criado com sucesso.

202 Accepted:
- processamento assíncrono aceito.

204 No Content:
- operação concluída sem corpo de resposta.

400 Bad Request:
- entrada inválida;
- erro de validação.

401 Unauthorized:
- usuário não autenticado.

403 Forbidden:
- usuário autenticado, mas sem permissão.

404 Not Found:
- recurso não encontrado.

409 Conflict:
- conflito de estado;
- recurso duplicado;
- operação inválida no estado atual.

422 Unprocessable Entity:
- payload semanticamente inválido, se o projeto optar por diferenciar de 400.

500 Internal Server Error:
- erro inesperado.

---

## 40. Rotas Assíncronas

Quando uma rota iniciar processamento demorado, ela deve retornar 202 Accepted.

Exemplo:

POST /api/verifications/{verificationId}/process-document

Resposta:

{
  "status": "ACCEPTED",
  "message": "Document processing started",
  "verificationId": "uuid"
}

O processamento pode ser delegado para:

- fila;
- job;
- evento;
- worker;
- função assíncrona;
- serviço externo.

Evitar manter requisições HTTP abertas por muito tempo.

---

## 41. Logs

Rotas backend devem registrar logs relevantes, especialmente em fluxos críticos.

Sugestão de informações:

- requestId;
- userId;
- companyId;
- verificationId;
- event type;
- status;
- duração;
- erro.

Evitar logar dados sensíveis.

Nunca logar:

- documentos pessoais completos;
- CPF completo;
- secrets;
- tokens;
- private keys;
- imagens;
- payloads sensíveis completos.

---

## 42. Segurança

Regras gerais:

- validar toda entrada externa;
- nunca confiar no client;
- não expor secrets;
- não retornar stack trace em produção;
- sanitizar mensagens de erro;
- verificar autorização em ações sensíveis;
- proteger rotas administrativas;
- evitar logs com PII;
- usar HTTPS em produção;
- usar rate limiting em rotas públicas;
- validar origem em integrações sensíveis.

---

## 43. Organização de Rotas por Caso de Uso

Cada rota deve mapear claramente para um caso de uso.

Exemplo:

POST /api/verifications
  -> CreateVerificationUseCase

GET /api/verifications/{verificationId}
  -> GetVerificationUseCase

POST /api/verifications/{verificationId}/submit-proof
  -> SubmitProofUseCase

POST /api/verifications/{verificationId}/approve
  -> ApproveVerificationUseCase

POST /api/verifications/{verificationId}/reject
  -> RejectVerificationUseCase

GET /api/companies/{companyId}/verifications
  -> ListCompanyVerificationsUseCase

---

## 44. Checklist para Criar uma Nova Rota

Ao criar uma nova rota backend, o agente de IA deve seguir este checklist:

1. Identificar o recurso da rota.
2. Definir método HTTP correto.
3. Criar ou reutilizar o arquivo route.ts dentro de src/app/api.
4. Criar DTO de entrada, se necessário.
5. Criar schema de validação, se necessário.
6. Criar use case em application/usecases.
7. Criar ou reutilizar entidades de domínio.
8. Criar ou reutilizar interfaces de repositório no domínio.
9. Criar implementação concreta na infra, se necessário.
10. Criar mapper, se houver conversão entre banco e domínio.
11. Criar controller em presentation/controllers.
12. Criar factory em factories.
13. Conectar route.ts à factory.
14. Padronizar tratamento de erro.
15. Retornar status HTTP correto.
16. Garantir que nenhum secret será exposto.
17. Garantir que a rota tem validação de entrada.
18. Garantir que a rota tem autorização, quando necessário.

---

## 45. Exemplo Completo de Criação de Rota

Objetivo:

Criar rota para iniciar uma verificação.

Endpoint:

POST /api/verifications

Arquivos esperados:

src/app/api/verifications/route.ts

src/modules/verification/domain/entities/Verification.ts
src/modules/verification/domain/enums/VerificationStatus.ts
src/modules/verification/domain/enums/VerificationType.ts
src/modules/verification/domain/repositories/VerificationRepository.ts

src/modules/verification/application/dtos/CreateVerificationDTO.ts
src/modules/verification/application/usecases/CreateVerificationUseCase.ts

src/modules/verification/infra/repositories/SupabaseVerificationRepository.ts
src/modules/verification/infra/mappers/VerificationMapper.ts

src/modules/verification/presentation/controllers/CreateVerificationController.ts

src/modules/verification/factories/makeCreateVerificationController.ts

src/shared/http/handleHttpError.ts
src/shared/errors/AppError.ts

---

## 46. Route Handler Completo

src/app/api/verifications/route.ts

import { NextRequest, NextResponse } from "next/server";
import { makeCreateVerificationController } from "@/modules/verification/factories/makeCreateVerificationController";
import { handleHttpError } from "@/shared/http/handleHttpError";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const controller = makeCreateVerificationController();

    const result = await controller.handle(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}

---

## 47. DTO Completo

src/modules/verification/application/dtos/CreateVerificationDTO.ts

import { z } from "zod";

export const CreateVerificationSchema = z.object({
  companyId: z.string().uuid(),
  type: z.enum(["PERSONHOOD", "AGE_OVER_18"]),
});

export type CreateVerificationDTO = z.infer<typeof CreateVerificationSchema>;

export type CreateVerificationOutputDTO = {
  id: string;
  companyId: string;
  type: "PERSONHOOD" | "AGE_OVER_18";
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
};

---

## 48. Controller Completo

src/modules/verification/presentation/controllers/CreateVerificationController.ts

import { CreateVerificationUseCase } from "../../application/usecases/CreateVerificationUseCase";
import { CreateVerificationSchema } from "../../application/dtos/CreateVerificationDTO";

export class CreateVerificationController {
  constructor(
    private readonly createVerificationUseCase: CreateVerificationUseCase
  ) {}

  async handle(body: unknown) {
    const input = CreateVerificationSchema.parse(body);

    return await this.createVerificationUseCase.execute(input);
  }
}

---

## 49. Factory Completa

src/modules/verification/factories/makeCreateVerificationController.ts

import { CreateVerificationUseCase } from "../application/usecases/CreateVerificationUseCase";
import { SupabaseVerificationRepository } from "../infra/repositories/SupabaseVerificationRepository";
import { CreateVerificationController } from "../presentation/controllers/CreateVerificationController";

export function makeCreateVerificationController() {
  const verificationRepository = new SupabaseVerificationRepository();

  const createVerificationUseCase = new CreateVerificationUseCase(
    verificationRepository
  );

  return new CreateVerificationController(createVerificationUseCase);
}

---

## 50. Use Case Completo

src/modules/verification/application/usecases/CreateVerificationUseCase.ts

import { Verification } from "../../domain/entities/Verification";
import { VerificationRepository } from "../../domain/repositories/VerificationRepository";
import { VerificationStatus } from "../../domain/enums/VerificationStatus";
import { VerificationType } from "../../domain/enums/VerificationType";
import {
  CreateVerificationDTO,
  CreateVerificationOutputDTO,
} from "../dtos/CreateVerificationDTO";

export class CreateVerificationUseCase {
  constructor(
    private readonly verificationRepository: VerificationRepository
  ) {}

  async execute(input: CreateVerificationDTO): Promise<CreateVerificationOutputDTO> {
    const now = new Date();

    const expiresAt = new Date(now);
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const verification = new Verification({
      id: crypto.randomUUID(),
      companyId: input.companyId,
      type: input.type as VerificationType,
      status: VerificationStatus.PENDING,
      createdAt: now,
      expiresAt,
    });

    await this.verificationRepository.create(verification);

    return {
      id: verification.id,
      companyId: verification.companyId,
      type: verification.type,
      status: verification.status,
      createdAt: verification.createdAt.toISOString(),
      expiresAt: verification.expiresAt.toISOString(),
    };
  }
}

---

## 51. Repository Interface Completa

src/modules/verification/domain/repositories/VerificationRepository.ts

import { Verification } from "../entities/Verification";

export interface VerificationRepository {
  create(verification: Verification): Promise<void>;
  findById(id: string): Promise<Verification | null>;
  update(verification: Verification): Promise<void>;
  listByCompanyId(companyId: string): Promise<Verification[]>;
}

---

## 52. Repository Implementation Completa

src/modules/verification/infra/repositories/SupabaseVerificationRepository.ts

import { Verification } from "../../domain/entities/Verification";
import { VerificationRepository } from "../../domain/repositories/VerificationRepository";
import { VerificationMapper } from "../mappers/VerificationMapper";
import { supabaseServerClient } from "@/lib/supabase/server";

export class SupabaseVerificationRepository implements VerificationRepository {
  async create(verification: Verification): Promise<void> {
    const persistence = VerificationMapper.toPersistence(verification);

    const { error } = await supabaseServerClient
      .from("verifications")
      .insert(persistence);

    if (error) {
      throw error;
    }
  }

  async findById(id: string): Promise<Verification | null> {
    const { data, error } = await supabaseServerClient
      .from("verifications")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return VerificationMapper.toDomain(data);
  }

  async update(verification: Verification): Promise<void> {
    const persistence = VerificationMapper.toPersistence(verification);

    const { error } = await supabaseServerClient
      .from("verifications")
      .update(persistence)
      .eq("id", verification.id);

    if (error) {
      throw error;
    }
  }

  async listByCompanyId(companyId: string): Promise<Verification[]> {
    const { data, error } = await supabaseServerClient
      .from("verifications")
      .select("*")
      .eq("company_id", companyId);

    if (error || !data) {
      return [];
    }

    return data.map(VerificationMapper.toDomain);
  }
}

---

## 53. Regras para Agentes de IA

Ao trabalhar neste projeto, agentes de IA devem obedecer às seguintes regras:

1. Nunca colocar regra de negócio diretamente em route.ts.
2. Nunca acessar banco diretamente em route.ts.
3. Nunca chamar SDK externo diretamente em route.ts.
4. Sempre criar ou reutilizar use cases.
5. Sempre validar entrada externa.
6. Sempre usar DTOs para contratos relevantes.
7. Sempre usar factories para montar dependências.
8. Sempre manter interfaces no domínio.
9. Sempre manter implementações concretas na infra.
10. Sempre retornar erros no padrão do projeto.
11. Sempre usar status HTTP coerente.
12. Nunca expor secrets em respostas HTTP.
13. Nunca misturar responsabilidade de módulos diferentes sem necessidade.
14. Sempre seguir a estrutura já existente do projeto antes de criar uma nova variação.
15. Sempre preferir clareza e previsibilidade em vez de abstração excessiva.

---

## 54. Quando Criar um Novo Módulo

Criar um novo módulo quando houver um novo domínio funcional relevante.

Exemplos:

- company;
- verification;
- proof-session;
- identity;
- document;
- blockchain;
- webhook;
- billing;
- audit-log.

Não criar módulo novo para algo que é apenas detalhe técnico.

Exemplo:

Não criar módulo separado apenas para Supabase.
Supabase é infraestrutura.

Não criar módulo separado apenas para Zod.
Zod é ferramenta de validação.

Não criar módulo separado apenas para HTTP.
HTTP é camada de adaptação.

---

## 55. Quando Criar um Novo Use Case

Criar um novo use case quando houver uma ação de aplicação clara.

Exemplos:

- CreateVerificationUseCase;
- GetVerificationUseCase;
- ListVerificationsUseCase;
- SubmitProofUseCase;
- ApproveVerificationUseCase;
- RejectVerificationUseCase;
- CreateCompanyUseCase;
- RotateApiKeyUseCase;
- AnchorCommitmentUseCase.

Evitar use cases genéricos demais.

Evitar:

- ManageVerificationUseCase;
- HandleVerificationUseCase;
- ProcessEverythingUseCase.

---

## 56. Quando Criar um Novo Controller

Criar um novo controller quando houver uma entrada HTTP específica para adaptar.

Exemplos:

- CreateVerificationController;
- GetVerificationController;
- SubmitProofController;
- ListVerificationsController.

Controllers devem ser pequenos.

Se um controller ficar grande, provavelmente existe lógica de aplicação vazando para ele.

---

## 57. Quando Criar um Novo Repository

Criar um repository quando o domínio precisa persistir ou recuperar entidades.

Exemplos:

- VerificationRepository;
- CompanyRepository;
- ProofSessionRepository;
- IdentityRepository;
- CommitmentRepository.

Não criar repository para simples chamadas de API externa que não representam persistência de entidade. Para isso, preferir service interface.

---

## 58. Quando Criar um Service

Criar um service quando o domínio ou aplicação precisa de uma capacidade externa ou regra especializada.

Exemplos:

- ProofVerifier;
- DocumentReader;
- CommitmentRegistry;
- HashGenerator;
- SignatureVerifier;
- WebhookSigner;
- EmailSender.

A interface pode ficar no domínio quando representa uma capacidade necessária ao domínio.

A implementação concreta fica na infra.

---

## 59. Exemplo de Modelagem para YaID

Rotas possíveis:

POST /api/companies
GET /api/companies/{companyId}
PATCH /api/companies/{companyId}

POST /api/company-apps
GET /api/company-apps/{appId}
PATCH /api/company-apps/{appId}

POST /api/proof-requests
GET /api/proof-requests/{proofRequestId}
GET /api/companies/{companyId}/proof-requests

POST /api/proof-sessions
GET /api/proof-sessions/{sessionId}
POST /api/proof-sessions/{sessionId}/submit-document
POST /api/proof-sessions/{sessionId}/submit-proof
POST /api/proof-sessions/{sessionId}/complete

POST /api/identity/commitments
GET /api/identity/commitments/{commitmentId}

POST /api/blockchain/commitments
GET /api/blockchain/commitments/{commitmentId}

POST /api/webhooks/proof-result

Módulos possíveis:

modules/
  company/
  company-app/
  proof-request/
  proof-session/
  identity/
  document/
  blockchain/
  webhook/

---

## 60. Exemplo de Fluxo Backend para Verificação

Fluxo:

1. Empresa cria proof request.
2. Backend cria registro de solicitação.
3. Backend retorna link ou QR Code.
4. Usuário abre o app.
5. App inicia proof session.
6. App envia imagem do documento.
7. Backend processa OCR.
8. Backend valida dados.
9. Backend cria commitment.
10. Backend opcionalmente ancora commitment em blockchain.
11. Backend salva resultado.
12. Empresa consulta status.

Rotas envolvidas:

POST /api/proof-requests
POST /api/proof-sessions
POST /api/proof-sessions/{sessionId}/submit-document
POST /api/proof-sessions/{sessionId}/submit-proof
GET /api/proof-requests/{proofRequestId}
GET /api/proof-sessions/{sessionId}

---

## 61. Regra Final

O backend em Next.js deve ser tratado como uma aplicação backend real, não como um conjunto de endpoints soltos.

Cada rota deve ser pequena.

Cada controller deve adaptar entrada.

Cada use case deve executar uma intenção clara.

Cada entidade deve proteger regra de domínio.

Cada repository interface deve pertencer ao domínio.

Cada implementação concreta deve ficar na infra.

Cada factory deve montar dependências.

Cada erro deve ser padronizado.

Cada entrada externa deve ser validada.

Cada rota deve poder ser compreendida, modificada e expandida por agentes de IA sem quebrar a arquitetura geral do projeto.