# Code Index — New Lanterns Status Portal

> Quick-reference for AI assistants to locate code and make changes efficiently.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript 5.9, TailwindCSS 4, Wouter (routing) |
| Backend | Express 4, tRPC 11, Node.js with tsx |
| Database | MySQL via Drizzle ORM 0.44 |
| UI Library | Shadcn/ui (Radix UI primitives) |
| Auth | JWT sessions in httpOnly cookies, OAuth + email/password |
| State | React Query (via tRPC) for server state, React Context for theme |
| Testing | Vitest |

## Project Structure

```
├── client/src/           # React frontend
│   ├── pages/            # Route components (wouter)
│   ├── components/       # Business components + ui/ (shadcn)
│   ├── hooks/            # Custom hooks
│   ├── contexts/         # React contexts (theme)
│   ├── lib/              # Utilities (trpc client, csv, utils)
│   ├── _core/hooks/      # Auth hook
│   ├── App.tsx           # Router definitions
│   ├── main.tsx          # Entry point, tRPC/QueryClient setup
│   └── index.css         # Global styles, theme variables
├── server/               # Express + tRPC backend
│   ├── routers/          # tRPC routers by feature
│   ├── _core/            # Auth, context, middleware, integrations
│   ├── db.ts             # Database connection
│   └── *.test.ts         # Server tests (19 files)
├── shared/               # Types & logic shared client↔server
├── drizzle/              # DB schema + migrations
│   ├── schema.ts         # All table definitions
│   └── relations.ts      # Table relationships
└── scripts/              # DB seeding & migration scripts
```

## Key Entry Points

| What | File |
|------|------|
| Client entry | `client/src/main.tsx` |
| Client router | `client/src/App.tsx` |
| Server bootstrap | `server/_core/index.ts` |
| Server prod entry | `server/index.ts` |
| tRPC root router | `server/routers/routers.ts` |
| DB schema | `drizzle/schema.ts` |
| DB relations | `drizzle/relations.ts` |
| DB connection | `server/db.ts` |
| Shared types | `shared/types.ts` |
| Env vars | `server/_core/env.ts` |

## Frontend Routes → Files

| Route | File | Description |
|-------|------|-------------|
| `/login` | `client/src/pages/Login.tsx` | OAuth login |
| `/forgot-password` | `client/src/pages/ForgotPassword.tsx` | Password recovery |
| `/reset-password` | `client/src/pages/ResetPassword.tsx` | Password reset |
| `/org/admin` | `client/src/pages/PlatformAdmin.tsx` | Admin console (users, orgs, questions) |
| `/org/admin/create` | `client/src/pages/CreateOrganization.tsx` | Org creation wizard |
| `/org/:slug` | `client/src/pages/Home.tsx` | Main dashboard |
| `/org/:slug/intake` | `client/src/pages/IntakeNewRedesign.tsx` | Intake questionnaire (current) |
| `/org/:slug/implement` | `client/src/pages/Implementation.tsx` | Implementation tracking |
| `/org/:slug/validation` | `client/src/pages/Validation.tsx` | Validation checklist |
| `/org/:slug/workflows` | `client/src/pages/Workflows.tsx` | Workflow visualization |
| `/org/:slug/specs` | `client/src/pages/Specifications.tsx` | Specifications docs |
| `/org/:slug/connectivity` | `client/src/pages/Connectivity.tsx` | Network connectivity |
| `/org/:slug/tasks` | `client/src/pages/Tasks.tsx` | Task management + CSV |
| `/org/:slug/complete` | `client/src/pages/IntakeComplete.tsx` | Completion screen |

## Backend API Routers

| Router | File | Key Endpoints |
|--------|------|---------------|
| **auth** | `server/routers/auth.ts` | login, logout |
| **organizations** | `server/routers/organizations.ts` | create, getBySlug, getSectionProgress, getTaskCompletion, getValidationResults, getActivityFeed |
| **users** | `server/routers/users.ts` | list, create, update, delete, updatePassword |
| **admin** | `server/routers/admin.ts` | questions CRUD, questionOptions CRUD, upsertOrganization, listOrganizations, vendor options, partner templates |
| **intake** | `server/routers/intake.ts` | getResponses, submitResponse, autoSaveResponse, deleteFile |
| **files** | `server/routers/files.ts` | uploadFile, getFiles, deleteFile |
| **validation** | `server/routers/validation.ts` | getResults, updateResult |
| **implementation** | `server/routers/implementation.ts` | getTasks, updateTask |
| **connectivity** | `server/routers/connectivity.ts` | getConnectivityMatrix, saveConnectivityEntry |
| **webhooks** | `server/routers/webhooks.ts` | linearComment (from Zapier) |
| **root** | `server/routers/routers.ts` | Merges all routers; top-level me, logout |

## Database Tables (drizzle/schema.ts)

| Table | Purpose |
|-------|---------|
| `users` | Auth & profile (id, openId, email, passwordHash, role, organizationId, clientId) |
| `clients` | Partner companies (RadOne, SRV) with slug and status |
| `organizations` | Clinical facilities under each client |
| `questions` | Master question definitions with type & options |
| `questionOptions` | Dropdown/multi-select options per question |
| `responses` | User answers to questions |
| `sectionProgress` | Completion tracking per section |
| `taskCompletion` | Individual task status (completed/inProgress/blocked/notApplicable) |
| `fileAttachments` | File metadata (S3 URL, size, MIME) |
| `validationResults` | Test results (Pass/Fail/Pending, notes, sign-off) |
| `activityFeed` | Activity log from integrations |
| `passwordResetTokens` | Password reset tokens |
| `onboardingFeedback` | User ratings on intake experience |
| `partnerTemplates` | Template files scoped to partners |
| `specifications` | Global spec documents |
| `systemVendorOptions` | Admin picklist for vendors (PACS, EHR) |
| `vendorAuditLog` | Audit trail for vendor changes |
| `intakeResponses` | Legacy intake responses (deprecated) |
| `intakeFileAttachments` | Legacy file attachments (deprecated) |

## Auth & Middleware (server/_core/)

| File | Purpose |
|------|---------|
| `trpc.ts` | tRPC init; defines `publicProcedure`, `protectedProcedure`, `adminProcedure` |
| `context.ts` | Creates tRPC context; extracts user from cookie JWT |
| `authRoutes.ts` | Express POST `/api/auth/login` (email/password) |
| `oauth.ts` | Express GET `/api/oauth/callback` (OAuth flow) |
| `sdk.ts` | OAuthService class — token exchange, user info, JWT creation |
| `cookies.ts` | Session cookie config helper |
| `env.ts` | All environment variables |

## Frontend Components

### Business Components (`client/src/components/`)

| Component | Purpose |
|-----------|---------|
| `DashboardLayout.tsx` | Main layout with sidebar navigation |
| `IntakeForm.tsx` | Questionnaire form with multi-section wizard |
| `FileUpload.tsx` | Drag-drop file upload (tRPC files.upload) |
| `FilesManagement.tsx` | File list management |
| `UserManagement.tsx` | User CRUD with role assignment |
| `OrganizationManagement.tsx` | Org settings |
| `ConnectivityTable.tsx` | Network connectivity status |
| `WorkflowDiagram.tsx` | Swimlane workflow visualization |
| `ActivityFeed.tsx` | Timeline of org activity |
| `AIChatBox.tsx` | AI chat interface with streaming |
| `Map.tsx` | Geographic/facility map |
| `ErrorBoundary.tsx` | React error boundary |

### UI Components (`client/src/components/ui/`)
52 Shadcn/ui components (Radix-based). Key ones: button, card, dialog, form, input, select, table, tabs, sidebar, sheet, badge, alert, progress, skeleton, dropdown-menu, command (combobox), toast (sonner).

## Shared Code (`shared/`)

| File | Purpose |
|------|---------|
| `types.ts` | Re-exports schema types from drizzle |
| `const.ts` | Constants (COOKIE_NAME, timeouts, error messages) |
| `_core/errors.ts` | HttpError class, error constructors |
| `taskDefs.ts` | Section/task definitions for implementation workflow |
| `progressCalculation.ts` | Intake progress calculation with conditional visibility |
| `intake-questions.ts` | Intake questionnaire schema |
| `questionnaireData.ts` | Master questionnaire data structure |
| `workflowQuestions.ts` | Workflow-specific questions |

## Third-Party Integrations

| Integration | Server File | Purpose |
|-------------|-------------|---------|
| Linear | `server/linear.ts` | Post/get comments on issues via MCP CLI |
| ClickUp | `server/clickup.ts` | Create tasks in ClickUp lists |
| Notion | `server/notion.ts` | Connectivity matrix, file uploads |
| Google Drive | `server/routers/files.ts` | File storage (googleapis) |
| S3 / Forge | `server/storage.ts` | File storage with pre-signed URLs |
| Whisper | `server/_core/voiceTranscription.ts` | Audio transcription |
| LLM | `server/_core/llm.ts` | AI message/tool types |
| Google Maps | `server/_core/map.ts` | Map API requests |

## Utilities

| File | Purpose |
|------|---------|
| `client/src/lib/utils.ts` | `cn()` — clsx + tailwind-merge |
| `client/src/lib/csv.ts` | CSV parse/build/download |
| `client/src/lib/adminUtils.ts` | Section progress data transform |
| `client/src/lib/trpc.ts` | tRPC React client (typed to AppRouter) |
| `client/src/const.ts` | `getLoginUrl()` for OAuth redirect |
| `client/src/hooks/useAuth.ts` | Auth state, logout, redirect |
| `client/src/hooks/useMobile.tsx` | Mobile viewport detection |
| `client/src/contexts/ThemeContext.tsx` | Dark/light theme provider |

## Common Change Patterns

### Add a new page
1. Create component in `client/src/pages/NewPage.tsx`
2. Add route in `client/src/App.tsx`
3. Add sidebar link in `client/src/components/DashboardLayout.tsx`

### Add a new API endpoint
1. Create or edit router in `server/routers/`
2. If new router, register it in `server/routers/routers.ts`
3. Call from client via `trpc.routerName.endpointName.useQuery()` or `.useMutation()`

### Add a new database table
1. Define table in `drizzle/schema.ts`
2. Add relations in `drizzle/relations.ts`
3. Run `npm run db:push` or generate migration with drizzle-kit
4. Export types from `shared/types.ts` if needed

### Add a new intake question
1. Edit `shared/questionnaireData.ts` or `shared/intake-questions.ts`
2. Update `shared/progressCalculation.ts` if conditional logic needed
3. Sync to DB via `scripts/sync-questions.mjs`

### Modify file upload behavior
1. Client: `client/src/components/FileUpload.tsx`
2. Server: `server/routers/files.ts`
3. Storage: `server/storage.ts` (Forge/S3) or `server/notion.ts` (Notion)

### Change auth/permissions
1. Middleware: `server/_core/trpc.ts` (procedure definitions)
2. Context: `server/_core/context.ts` (user extraction)
3. Login: `server/_core/authRoutes.ts` (email/password) or `server/_core/oauth.ts` (OAuth)
4. Client: `client/src/_core/hooks/useAuth.ts`

### Add/modify admin features
1. Backend: `server/routers/admin.ts`
2. Frontend: `client/src/pages/PlatformAdmin.tsx`

## NPM Scripts

| Script | Command |
|--------|---------|
| `dev` | Start dev server |
| `build` | Production build |
| `test` | Run vitest |
| `db:push` | Push schema to database |
