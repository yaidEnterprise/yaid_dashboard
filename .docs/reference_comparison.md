# Reference vs Current — Gap Analysis

## Key Differences to Implement

### 1. Design System (CSS tokens)
- **Ref uses HSL-based tokens** with `hsl(var(--xxx))` pattern — our current uses hex-based `@theme inline`
- **Missing token categories**: `--trust`, `--privacy`, `--verified`, `--surface`, `--surface-muted`, `--code-*`, `--env-*`, `--shadow-card`, `--shadow-elevated`, `--border-strong`
- **Ref uses semantic bg/text/border triplets** for status colors (e.g., `--success-bg`, `--success-text`, `--success-border`)

### 2. Layout (Sidebar uses shadcn/ui Sidebar component)
- **Ref uses collapsible sidebar** via shadcn `<SidebarProvider>` + `<Sidebar collapsible="icon">`
- **Ref sidebar has nav groups** ("Principal", "Integração") with labels
- **Ref sidebar has footer** with "Documentação" card
- **Ref topbar** shows env badge, sidebar trigger, company name differently

### 3. Components
- **MetricCard**: Ref has `trend` (up/down %) and `hint` text — ours lacks trends
- **StatusBadge**: Ref uses lucide icons (CheckCircle2, Clock, XCircle, etc.) — ours uses dots
- **EnvBadge**: Ref uses lucide icons (FlaskConical, ShieldCheck) — ours uses inline SVGs
- **InlineCode**: Ref has a dedicated inline code component for IDs in tables — ours uses CopyButton separately
- **CodeBlock**: Ref uses `yaid-code` class with `--code-*` tokens
- **FilterPopover**: Ref has a popover-based multi-select filter — ours uses basic `<select>`

### 4. Pages
- **Overview**: Ref has "Próximo passo recomendado" card with Privacy teal accent; ours has onboarding cards only. Ref has "Apps ativos" summary card.
- **Apps**: Ref has search input + popover filters + pagination footer — ours has no search, basic selects, no pagination
- **Create App**: Ref has breadcrumb, back link, form split into card sections (Identificação/Ambiente/Webhook), side "Antes de criar" + "Privacidade" cards, and a **blocking modal** for API key reveal. Ours has separate pages.
- **Proof Requests**: Ref has search + multiple popover filters (Status/Ambiente/App/Range) + summary mini-cards above table + pagination footer — ours has basic selects only
- **Proof Request Detail**: Ref has breadcrumb, 2-column grid (summary + confirmed attributes + API response || timeline + privacy card) — ours has a flat layout
- **Profile/Settings**: Ref has company logo, CNPJ/Razão social fields, email with verified badge, Stripe billing card, and logout button — ours is simpler

### 5. Missing Features
- [x] `lucide-react` icon library (ref uses it everywhere)
- [x] `sonner` toast notifications
- [x] `appsStore` with localStorage persistence + subscribe pattern
- [x] Blocking modal for API key reveal (instead of separate page)
- [x] Search inputs on listing pages
- [x] Popover-based multi-select filters
- [x] Pagination footer on tables
- [x] Breadcrumbs on detail/create pages
- [x] Privacy/Trust notice cards
- [x] Stripe billing section on profile
