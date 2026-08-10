---
name: nextjs-backend
description: Layered backend architecture for Next.js + TypeScript projects. Use this skill whenever the user wants to implement a backend feature, API route, use case, service, repository, or any server-side logic in a Next.js project. Trigger for: "implement this endpoint", "create a route", "add a use case", "build the backend for X", "implement story X", "create API for X", "add a controller", "implement the repository", "wire up the backend". This skill enforces strict layer separation — route handler, presenter, controller, use case, viewmodel, shared domain, shared infra, external clients, and environments. Do NOT use for frontend, React components, pages, layouts, or UI unless explicitly asked.
---

# Next.js Backend Architecture Skill

You are implementing a backend feature in a Next.js + TypeScript project. Follow this skill exactly. Do not create frontend pages, React components, layouts, or UI unless the user explicitly asks for them.

## Your Mindset

Implement one feature at a time, scoped to the story or brief given. Before touching any file:

1. Read the story/brief carefully.
2. Inspect existing patterns in the repository — follow what's already there.
3. Present a short plan (what files you'll create/modify) before writing anything.
4. Make small, scoped changes. Do not invent features outside the story scope.
5. Report assumptions explicitly.
6. At the end, list all files created/modified, tests run, and any open items.

---

## Target Project Structure

```
src/
  modules/
    {feature}/
      app/
        {action}_{feature}_usecase.ts
        {action}_{feature}_viewmodel.ts
        {action}_{feature}_controller.ts
        {action}_{feature}_presenter.ts

  shared/
    clients/
    domain/
      entities/
      enums/
      interfaces/
        repositories/   # repository interfaces (e.g. CompanyRepository.ts)
                        # any other interface that has a concrete equivalent in shared/infra
                        # (e.g. ApiKeyHasher.ts, OcrProvider.ts, BlockchainClient.ts)
    infra/
      dto/
      repositories/
      providers/
    environments.ts
    errors/
    middlewares/
    config/

app/
  api/
    {resource}/
      route.ts           # static route
      [id]/
        route.ts         # dynamic route
```

---

## Layer Responsibilities

### 1. `app/api/**/route.ts` — HTTP Adapter Only

This file is a thin Next.js HTTP adapter. It knows nothing about the application.

**Can:**
- Accept `NextRequest`, return `NextResponse`
- Read body, query params, path params
- Call the presenter to get the controller, then call the controller
- Convert `ControllerResponse` into `NextResponse`

**Cannot:**
- Contain business logic
- Access a database directly
- Instantiate repositories
- Read `process.env`
- Call external SDKs directly
- Contain complex validation
- Orchestrate application flow

```typescript
// app/api/companies/route.ts
export async function POST(request: NextRequest) {
  const controller = makeCreateCompanyController()
  const body = await request.json()
  const result = await controller.handle({ body })
  return NextResponse.json(result.body, { status: result.statusCode })
}
```

---

### 2. Presenter — Composition Root

File: `src/modules/{feature}/app/{action}_{feature}_presenter.ts`

The presenter is the only place where concrete dependencies are wired together. It reads configuration, instantiates everything, and returns the ready controller.

**Must:**
- Read from `environments.ts`
- Choose concrete implementations based on `STAGE` if needed
- Instantiate repositories, clients, providers, use case, controller, middlewares
- Return the controller

**Must not:**
- Contain business logic
- Validate payloads
- Format public responses
- Execute feature flow

```typescript
// src/modules/company/app/create_company_presenter.ts
export function makeCreateCompanyController() {
  const env = getEnvironments()
  const repository = new CompanyRepositoryImpl(env.supabaseClient)
  const useCase = new CreateCompanyUseCase(repository)
  return new CreateCompanyController(useCase)
}
```

---

### 3. Controller — Input Validation + Orchestration

File: `src/modules/{feature}/app/{action}_{feature}_controller.ts`

**Must:**
- Validate input format, required fields, basic types
- Convert external request into use case input DTO
- Execute try/catch
- Call the use case
- Call the viewmodel when applicable
- Map expected errors to an abstract response

**Must not:**
- Contain business logic
- Access a database
- Call external SDKs
- Instantiate concrete implementations
- Return domain entities or persistence models directly

**Return type:**

```typescript
type ControllerResponse<T> = {
  statusCode: number
  body: T
  headers?: Record<string, string>
}
```

`route.ts` converts this into `NextResponse`.

---

### 4. Use Case — Business/Application Logic

File: `src/modules/{feature}/app/{action}_{feature}_usecase.ts`

**Must:**
- Contain the business or application rule
- Orchestrate domain entities and contracts
- Depend on interfaces, never concrete implementations
- Call repositories/providers through contracts
- Return an output DTO

**Must not:**
- Import `NextRequest` or `NextResponse`
- Read `process.env`
- Instantiate concrete repositories
- Import from `shared/infra`
- Return HTTP status codes or framework objects
- Call external SDKs directly when an interface should exist instead

The use case must be callable by any transport: HTTP, queue, cron, CLI, or test.

---

### 5. ViewModel — Public Response Shape

File: `src/modules/{feature}/app/{action}_{feature}_viewmodel.ts`

**Must:**
- Define the public response format
- Convert use case output into a safe response
- Remove sensitive fields
- Prevent domain entity or persistence model from leaking out

**Must not:**
- Contain business logic
- Access a database or external SDK
- Read environment variables

---

### 6. `src/shared/domain` — Domain Contracts

**Contains:** entities, enums, domain errors (if applicable), and under `interfaces/`:
- `interfaces/repositories/` — repository contracts (e.g. `CompanyRepository.ts`)
- `interfaces/` — any other contract that has a concrete equivalent in `shared/infra` (e.g. `ApiKeyHasher.ts`, `OcrProvider.ts`, `BlockchainClient.ts`)

**Must not contain:** Next.js imports, database clients, external SDKs, `process.env`, concrete implementations, HTTP status codes, request/response objects

---

### 7. `src/shared/infra` — Concrete Implementations

**Contains:** concrete repository implementations, concrete providers, database/cache/storage adapters, persistence DTOs, entity↔persistence mappers

**Must not contain:** core business logic, HTTP response formatting, use case orchestration

---

### 8. `src/shared/clients` — External Service Wrappers

**Contains:** wrappers for external SDKs, HTTP clients, clients for OCR, storage, email, blockchain, identity/DID/VC/VP, etc.

Use cases must not call clients directly. Depend on an interface; let the presenter inject the concrete implementation.

---

### 9. `src/shared/environments.ts` — Centralized Config

**Must:**
- Read `process.env`
- Validate required variables at startup
- Export typed configuration
- Enable environment-based implementation selection. Example: variable STAGE at process.env is "A", so returns the selected infrastructure for database for the "A" STAGE.

**Must not:**
- Contain business logic
- Handle requests
- Be imported by domain or use cases

---

## Dependency Rules

```
Allowed:
  route.ts → presenter → controller → usecase → shared/domain
  shared/infra → shared/domain (interfaces)
  presenter → shared/environments, shared/infra, shared/clients

Forbidden:
  shared/domain → shared/infra
  shared/domain → Next.js
  usecase → NextRequest / NextResponse
  usecase → concrete repository
  controller → concrete database client
  route.ts → database client / process.env / external SDK
```

---

## Standard Request Flow

```
1.  Request arrives at app/api/**/route.ts
2.  route.ts calls the presenter to get the controller
3.  Presenter reads environments.ts
4.  Presenter instantiates concrete dependencies
5.  Presenter instantiates use case and controller
6.  route.ts forwards request to controller
7.  Controller validates input format
8.  Controller creates input DTO
9.  Controller calls use case
10. Use case executes business/application logic
11. Use case calls interfaces for persistence or external resources
12. shared/infra executes the concrete implementation
13. Use case returns output DTO
14. Controller calls viewmodel
15. ViewModel creates public response
16. Controller returns ControllerResponse
17. route.ts converts to NextResponse
```

---

## Naming Conventions

For feature `company`, action `create`:

| File | Path |
|------|------|
| Use Case | `src/modules/company/app/create_company_usecase.ts` |
| ViewModel | `src/modules/company/app/create_company_viewmodel.ts` |
| Controller | `src/modules/company/app/create_company_controller.ts` |
| Presenter | `src/modules/company/app/create_company_presenter.ts` |
| Repository interface | `src/shared/domain/interfaces/repositories/company_repository.ts` |
| Repository impl | `src/shared/infra/repositories/company_repository_impl.ts` |
| Entity | `src/shared/domain/entities/company.ts` |
| Enum | `src/shared/domain/enums/company_status.ts` |
| Persistence DTO | `src/shared/infra/dto/company_dto.ts` |
| Mapper | `src/shared/infra/dto/company_mapper.ts` |

**Class names:** `CreateCompanyUseCase`, `CreateCompanyController`, `CreateCompanyViewModel`, `makeCreateCompanyController`, `CompanyRepositoryImpl`, `CompanyMapper`, `CompanyDTO`

---

## DTO Separation

Keep these representations distinct — never pass one where another is expected:

- External request payload
- Use case input DTO
- Domain entity
- Persistence DTO
- Use case output DTO
- Public viewmodel

**Rules:**
- Never pass raw external payload directly to a domain entity
- Never return a database model from the API
- Never return a domain entity without a viewmodel
- Use mappers in `shared/infra/dto` for entity↔persistence conversion
- Use viewmodel for use case output → public response

---

## Validation Strategy

| Layer | Validates |
|-------|-----------|
| `environments.ts` | Required env vars at startup |
| Controller | Input format, required fields, basic types |
| Use case / domain | Business rules, invariants |
| `route.ts` | Nothing complex — just passes through |

---

## Error Strategy

- Expected errors must be explicit and typed
- Use cases must not know about HTTP
- Domain/application errors must not carry HTTP status codes
- Controller maps expected errors to `statusCode`
- `route.ts` only converts the abstract response to `NextResponse`
- Unexpected errors must return a safe, generic message
- Never expose: stack traces, secrets, SQL queries, sensitive payloads, internal endpoints

---

## Middleware Guidelines

Middlewares can handle: authentication, initial authorization, API key extraction, context creation, rate limiting, logging/correlation IDs, input normalization.

They must not hide core business logic.

---

## Implementation Workflow

Work through these steps in order:

1. Read the story/brief
2. Inspect existing patterns in the repo
3. Identify `{feature}` and `{action}`
4. Create/update entities, enums, interfaces in `shared/domain`
5. Create/update DTOs, mappers, concrete repositories in `shared/infra`
6. Create use case in the module
7. Create viewmodel in the module
8. Create controller in the module
9. Create presenter in the module
10. Create `route.ts` in `app/api`
11. Create or update tests
12. Run typecheck and tests if available
13. Report: files created/modified, tests run, open items

---

## Testing Priorities

1. Use case — with mocks/fakes for interfaces
2. Controller — invalid input, valid input, expected errors
3. ViewModel — correct public format, sensitive field removal
4. Mapper — entity↔persistence conversion correctness
5. Route handler — only when it adds meaningful coverage

---

## Prohibited Patterns

Never do any of these:

- Business logic in `route.ts`
- Direct database access in `route.ts` or controller
- `process.env` outside `shared/environments.ts`
- `NextRequest`/`NextResponse` in the use case
- Concrete infra in the use case
- Persistence model returned from the API
- Domain entity returned without a viewmodel
- External SDK called directly in the use case when an interface should exist
- Business logic in the presenter
- Complex rules in the controller
- Core business logic hidden in a middleware
- Unrelated features bundled in the same implementation
- Public contract changed without explicit user request

---

## Final Checklist

Before reporting done, verify:

- [ ] `route.ts` is thin — no DB access, no `process.env`, no business logic
- [ ] Presenter wires dependencies — no business logic
- [ ] Controller validates input and handles expected errors — no DB access
- [ ] Use case contains business/application logic — depends on interfaces, no Next.js imports
- [ ] ViewModel defines public response — removes sensitive fields
- [ ] Interfaces live in `shared/domain`
- [ ] Concrete implementations live in `shared/infra`
- [ ] External clients live in `shared/clients`
- [ ] `environments.ts` centralizes all env reading
- [ ] Persistence DTOs do not leak into API responses
- [ ] Tests cover happy path and relevant failure cases

---

## When Reviewing

Compare implementation against the story/brief:

- Identify architecture violations (use the layer rules above)
- Identify out-of-scope changes
- Identify missing tests
- Identify sensitive data leakage
- Return: **Approved** or **Not Approved** with mandatory corrections listed
