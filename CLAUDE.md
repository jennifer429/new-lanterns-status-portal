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
│   ├── hooks/            # Custom hooks (useMobile, useComposition, usePersistFn)
│   ├── contexts/         # React contexts (theme)
│   ├── lib/              # Utilities (trpc client, csv, utils, adminUtils)
│   ├── _core/hooks/      # Auth hook (useAuth)
│   ├── App.tsx           # Router definitions
│   ├── main.tsx          # Entry point, tRPC/QueryClient setup
│   └── index.css         # Global styles, theme variables
├── server/               # Express + tRPC backend
│   ├── routers/          # tRPC routers by feature
│   ├── _core/            # Auth, context, middleware, integrations, services
│   ├── routers.ts        # Root tRPC router (merges all sub-routers)
│   ├── db.ts             # Database connection (Drizzle + MySQL)
│   ├── webhooks.ts       # Express webhook endpoints (Zapier/Linear)
│   ├── linear.ts         # Linear integration (MCP CLI)
│   ├── clickup.ts        # ClickUp integration (MCP CLI)
│   ├── notion.ts         # Notion integration (API client)
│   ├── storage.ts        # Forge/S3 file storage
│   └── *.test.ts         # Server tests (19 files)
├── shared/               # Types & logic shared client↔server
├── drizzle/              # DB schema + migrations
│   ├── schema.ts         # All table definitions (18 tables)
│   └── relations.ts      # (Currently empty — no relations defined)
└── scripts/              # DB seeding & migration scripts
```

## Key Entry Points

| What | File |
|------|------|
| Client entry | `client/src/main.tsx` |
| Client router | `client/src/App.tsx` |
| Server bootstrap | `server/_core/index.ts` |
| Server prod entry | `server/index.ts` |
| tRPC root router | `server/routers.ts` |
| DB schema | `drizzle/schema.ts` |
| DB connection | `server/db.ts` |
| Shared types | `shared/types.ts` |
| Env vars | `server/_core/env.ts` |

## Frontend Routes → Files

| Route | File | Description |
|-------|------|-------------|
| `/` | *(redirect)* | Redirects to `/login` |
| `/login` | `client/src/pages/Login.tsx` | OAuth login |
| `/forgot-password` | `client/src/pages/ForgotPassword.tsx` | Password recovery |
| `/reset-password` | `client/src/pages/ResetPassword.tsx` | Password reset |
| `/admin` | `client/src/pages/Admin.tsx` | Legacy admin (deprecated) |
| `/org/admin/create` | `client/src/pages/CreateOrganization.tsx` | Org creation wizard |
| `/org/admin`, `/org/admin/users` | `client/src/pages/PlatformAdmin.tsx` | Platform admin console |
| `/org/:partnerSlug/admin/create` | `client/src/pages/CreateOrganization.tsx` | Partner admin org creation |
| `/org/:partnerSlug/admin`, `/org/:partnerSlug/admin/users` | `client/src/pages/PlatformAdmin.tsx` | Partner admin console |
| `/org/:clientSlug/:slug` | `client/src/pages/Home.tsx` | Main org dashboard |
| `/org/:clientSlug/:slug/intake` | `client/src/pages/IntakeNewRedesign.tsx` | Intake questionnaire |
| `/org/:clientSlug/:slug/implement` | `client/src/pages/Implementation.tsx` | Implementation tracking |
| `/org/:clientSlug/:slug/validation` | `client/src/pages/Validation.tsx` | Validation checklist |
| `/org/:clientSlug/:slug/workflows` | `client/src/pages/Workflows.tsx` | Workflow visualization |
| `/org/:clientSlug/:slug/specs` | `client/src/pages/Specifications.tsx` | Specifications docs |
| `/org/:clientSlug/:slug/connectivity` | `client/src/pages/Connectivity.tsx` | Network connectivity |
| `/org/:clientSlug/:slug/tasks` | `client/src/pages/Tasks.tsx` | Task management + CSV |
| `/org/:clientSlug/:slug/complete` | `client/src/pages/IntakeComplete.tsx` | Completion screen |
| `/org/:clientSlug/:slug/library` | `client/src/pages/ProceduralLibrary.tsx` | Procedural document library |
| `/org/:slug` | `client/src/pages/Home.tsx` | **Legacy** — auto-redirects to `/org/:clientSlug/:slug` |
| `/org/:slug/:subPage` | `LegacySubPageRedirect` | **Legacy** — auto-redirects to `/org/:clientSlug/:slug/:subPage` |
| `/404` | `client/src/pages/NotFound.tsx` | 404 page |

## URL Slug System (CRITICAL — read before changing navigation)

### Two-level slug architecture

Every org-level URL uses **two slugs**: the **partner/client slug** and the **org slug**.

```
/org/:clientSlug/:orgSlug/:subPage
      ^^^^^^^^^^  ^^^^^^^^  ^^^^^^^
      Partner     Org       Page
      (RadOne)    (boulder) (intake)
```

**Example:** `/org/RadOne/boulder/intake`
- `clientSlug` = `"RadOne"` — from the `clients.slug` DB column
- `orgSlug` = `"boulder"` — from the `organizations.slug` DB column
- `subPage` = `"intake"` — the page within the org

### DB tables that hold slugs

| Table | Column | Example | Used in URL as |
|-------|--------|---------|----------------|
| `clients` | `slug` | `"RadOne"`, `"SRV"` | `:clientSlug` (1st position) |
| `organizations` | `slug` | `"boulder"`, `"marshallmedical"` | `:slug` / `:orgSlug` (2nd position) |

### Key helper: `useOrgParams` hook

`client/src/hooks/useOrgParams.ts` extracts both slugs from the current URL:

```ts
const { clientSlug, slug, orgPath } = useOrgParams("intake");
// clientSlug = "RadOne", slug = "boulder", orgPath = "/org/RadOne/boulder"
```

### Rules for building navigation links

1. **ALWAYS use both slugs** when linking to org sub-pages:
   ```tsx
   // CORRECT
   <Link href={`/org/${clientSlug}/${orgSlug}/intake`}>
   
   // WRONG — produces broken URL like /org/boulder/intake
   <Link href={`/org/${orgSlug}/intake`}>
   ```

2. **Pass `clientSlug` as a prop** to any child component that renders navigation links.
   The Home.tsx dashboard passes `clientSlug` to all phase cards and resource cards.

3. **Never hardcode partner slugs** like `/org/RadOne/...`. Use dynamic values from:
   - `useOrgParams()` hook (in org-scoped pages)
   - `organization.clientSlug` from tRPC query (in the dashboard)
   - `clientSlugMap[org.clientId]` from admin views

### Legacy URL handling

Old-format URLs (`/org/:slug` and `/org/:slug/:subPage`) are still supported via
automatic redirects defined in `client/src/App.tsx`:

- `/org/boulder` → `Home` component redirects to `/org/RadOne/boulder` using org's `clientSlug`
- `/org/boulder/intake` → `LegacySubPageRedirect` looks up the org's clientSlug, redirects to `/org/RadOne/boulder/intake`

**Why this matters:** If you build a link with only the orgSlug (e.g. `/org/boulder/intake`),
Wouter will match it against `/org/:clientSlug/:slug` (the Home route), treating `"boulder"`
as the clientSlug and `"intake"` as the orgSlug. This cascades into completely broken navigation
where URLs degrade into nonsense like `/org/intake/implement`.

## Backend API Routers

| Router | File | Key Endpoints |
|--------|------|---------------|
| **root** | `server/routers.ts` | Merges all routers; top-level `me` (query), `logout` (mutation) |
| **auth** | `server/routers/auth.ts` | `login`, `checkEmail`, `createAdmin`, `resetPasswordDirect`, `changePassword` |
| **organizations** | `server/routers/organizations.ts` | `create`, `getBySlug`, `getProgress`, `updateSectionProgress`, `completeTask`, `list`, `getAll`, `getActivityFeed`, `getMetrics`, `update`, `inactivate`, `postReply` |
| **users** | `server/routers/users.ts` | `list`, `create`, `update`, `delete` |
| **admin** | `server/routers/admin.ts` | Questions: `getAllQuestions`, `createQuestion`, `updateQuestion`, `deleteQuestion`; Options: `getQuestionOptions`, `createQuestionOption`, `updateQuestionOption`, `deleteQuestionOption`, `reorderQuestionOptions`; Clients: `getAllClients`, `createClient`, `updateClient`, `deactivateClient`, `reactivateClient`; Orgs: `getAllOrganizations`, `createOrganization`, `updateOrganization`, `deleteOrganization`, `deactivateOrganization`, `reactivateOrganization`, `markOrganizationComplete`, `reopenOrganization`; Responses: `getAllOrgResponses`, `saveOrgResponse`, `bulkSaveOrgResponses`; Users: `getAllUsers`, `createUser`, `deactivateUser`, `reactivateUser`, `getCurrentUser`; Files: `getAllFiles`, `deleteFile`; Templates: `getTemplates`, `getInactiveTemplates`, `getTemplatesByClient`, `uploadTemplate`, `replaceTemplate`; Specs: `getSpecifications`, `uploadSpecification`, `updateSpecification`, `deactivateSpecification`; Vendors: `getSystemVendorOptions`, `getActiveVendorOptions`, `addVendorOption`, `updateVendorOption`, `toggleVendorOption`, `deleteVendorOption`, `addSystemType`, `seedDefaultVendorOptions`, `getVendorAuditLog`; Summary: `getAdminSummary` |
| **intake** | `server/routers/intake.ts` | `getOrganizationInfo`, `getFileCount`, `getResponses`, `saveResponse`, `saveResponses`, `getProgress`, `uploadFile`, `getAllQuestions`, `getResponsesNew`, `saveResponseNew`, `getCompletionMetricsNew`, `getQuestionsWithOptions`, `getQuestionOptions`, `getUploadedFiles`, `getAllUploadedFiles`, `previewFile`, `deleteFile`, `submitFeedback`, `getTemplatesForOrg`, `uploadAdhocFile`, `getAdhocFiles`, `getActiveVendorOptions` |
| **files** | `server/routers/files.ts` | `upload`, `getByTask`, `delete` |
| **validation** | `server/routers/validation.ts` | `getResults`, `updateResult` |
| **implementation** | `server/routers/implementation.ts` | `getTasks`, `updateTask` |
| **connectivity** | `server/routers/connectivity.ts` | `getForOrg`, `syncToNotion`, `createRow`, `updateRow`, `archiveRow` |
| **webhooks** | `server/routers/webhooks.ts` | `linearComment`, `clickupComment` |

## Database Tables (drizzle/schema.ts)

| Table | Purpose |
|-------|---------|
| `users` | Auth & profile (id, openId, email, passwordHash, role, organizationId, clientId, isActive) |
| `clients` | Partner companies (RadOne, SRV) with slug and status |
| `organizations` | Clinical facilities under each client (contact info, linearIssueId, clickupListId, googleDriveFolderId) |
| `questions` | Master question definitions (questionId, sectionId, shortTitle, type, options) |
| `questionOptions` | Dropdown/multi-select options per question (optionValue, optionLabel, displayOrder) |
| `responses` | User answers to questions (organizationId, questionId, response, fileUrl) |
| `sectionProgress` | Completion tracking per section (status: pending/in-progress/complete, progress %) |
| `taskCompletion` | Individual task status (completed/inProgress/blocked/notApplicable, targetDate, notes) |
| `fileAttachments` | File metadata for tasks (S3 URL, size, MIME, fileKey) |
| `validationResults` | Test results (status: Pass/Fail/Not Tested/Pending/N/A, signOff, notes, testedDate) |
| `activityFeed` | Activity log from integrations (source: linear/clickup/manual) |
| `passwordResetTokens` | Password reset tokens (token, expiresAt, used) |
| `onboardingFeedback` | User ratings on intake experience |
| `partnerTemplates` | Template files scoped to clients (clientId, questionId, s3Key) |
| `specifications` | Global spec documents (title, category, s3Key) |
| `systemVendorOptions` | Admin picklist for system vendors (systemType, vendorName) |
| `vendorAuditLog` | Audit trail for vendor picklist changes |
| `intakeResponses` | Legacy intake responses (deprecated) |
| `intakeFileAttachments` | Legacy file attachments (deprecated) |

## Auth & Middleware (server/_core/)

| File | Purpose |
|------|---------|
| `trpc.ts` | tRPC init; defines `publicProcedure`, `protectedProcedure`, `adminProcedure` |
| `context.ts` | Creates tRPC context; extracts user from cookie JWT |
| `authRoutes.ts` | Express POST `/api/auth/login` (email/password); sets session cookie |
| `oauth.ts` | Express GET `/api/oauth/callback` (OAuth flow); upserts user |
| `sdk.ts` | OAuthService class — token exchange, user info, JWT creation (axios) |
| `cookies.ts` | Session cookie config helper (httpOnly, secure, sameSite) |
| `env.ts` | All environment variables (22 settings: DB, OAuth, Notion, Drive, Forge, etc.) |
| `systemRouter.ts` | Health check endpoint and owner notification |
| `notification.ts` | Notification service (notifyOwner via WebDev service) |
| `dataApi.ts` | Forge Data API wrapper for calling internal services |
| `imageGeneration.ts` | Image generation via Forge service |
| `voiceTranscription.ts` | Whisper API integration for audio transcription |
| `llm.ts` | LLM message/tool type definitions for AI integration |
| `map.ts` | Google Maps API request helper |
| `vite.ts` | Vite dev server setup (HMR, middleware mode) |
| `index.ts` | Server bootstrap: Express, tRPC, auth routes, webhooks, Vite/static serving |

## Frontend Components

### Business Components (`client/src/components/`)

| Component | Purpose |
|-----------|---------|
| `DashboardLayout.tsx` | Main layout with sidebar navigation and auth menu |
| `DashboardLayoutSkeleton.tsx` | Loading skeleton for dashboard layout |
| `IntakeForm.tsx` | Questionnaire form with multi-section wizard |
| `FileUpload.tsx` | File upload with loading states and callbacks |
| `FileList.tsx` | File list with download/delete functionality |
| `FilePreviewItem.tsx` | File preview card with metadata |
| `UploadedFileRow.tsx` | File display row with preview/download/remove |
| `FilesManagement.tsx` | Admin file management across orgs |
| `UserManagement.tsx` | User CRUD with role assignment |
| `UserMenu.tsx` | Top-right user dropdown (password change, sign out) |
| `OrganizationManagement.tsx` | Org settings: view, create, rename |
| `ConnectivityTable.tsx` | Editable connectivity table with traffic types/IP config |
| `WorkflowDiagram.tsx` | Swimlane workflow visualization (Orders/Images/Priors/Reports) |
| `IntegrationWorkflows.tsx` | Integration workflow form with system type selectors |
| `ActivityFeed.tsx` | Timeline of org activity with reply functionality |
| `AIChatBox.tsx` | AI chat interface with streaming (Streamdown) |
| `ManusDialog.tsx` | Manus onboarding dialog |
| `Map.tsx` | Google Maps integration |
| `PhiDisclaimer.tsx` | PHI (Protected Health Information) warning banner |
| `WizardCompletion.tsx` | Wizard completion celebration screen |
| `PageBreadcrumb.tsx` | Breadcrumb navigation with Home icon |
| `ProgressLogo.tsx` | SVG progress indicator logo (0-100) |
| `ErrorBoundary.tsx` | React error boundary with reset |

### UI Components (`client/src/components/ui/`)
52 Shadcn/ui components (Radix-based). Key ones: button, card, dialog, form, input, select, table, tabs, sidebar, sheet, badge, alert, progress, skeleton, dropdown-menu, command (combobox), toast (sonner).

## Shared Code (`shared/`)

| File | Purpose |
|------|---------|
| `types.ts` | Re-exports schema types from drizzle + error types |
| `const.ts` | Constants (COOKIE_NAME, timeouts, error messages) |
| `_core/errors.ts` | HttpError class, constructors (BadRequest, Unauthorized, Forbidden, NotFound) |
| `taskDefs.ts` | Section/task definitions (TaskDef, SectionDef, SECTION_DEFS) for implementation workflow |
| `progressCalculation.ts` | Intake progress calculation with conditional visibility |
| `intake-questions.ts` | Real PACS implementation questionnaire from intake spreadsheet |
| `questionnaireData.ts` | RadOne New Site Onboarding Questionnaire (6 sections) |
| `questionnaire-data.ts` | Question data structure with QuestionOption interface (from Google Sheet) |
| `wizard-data.ts` | Wizard-style questionnaire with step-by-step yes/no + conditional logic |
| `workflowQuestions.ts` | Workflow-specific questions (9 sections, 4 visual workflow diagrams) |

## Third-Party Integrations

| Integration | Server File | Purpose |
|-------------|-------------|---------|
| Linear | `server/linear.ts` | Post/get comments on issues via MCP CLI |
| ClickUp | `server/clickup.ts` | Create tasks in ClickUp lists via MCP CLI |
| Notion | `server/notion.ts` | Intake response sync, file uploads (radone orgs) |
| Google Drive | `server/routers/files.ts` | File storage (googleapis) |
| S3 / Forge | `server/storage.ts` | File storage with pre-signed URLs (Biz storage proxy) |
| Whisper | `server/_core/voiceTranscription.ts` | Audio transcription |
| LLM | `server/_core/llm.ts` | AI message/tool types |
| Google Maps | `server/_core/map.ts` | Map API requests |
| Zapier | `server/webhooks.ts` | Express endpoint for Linear comment forwarding |

## Utilities

| File | Purpose |
|------|---------|
| `client/src/lib/utils.ts` | `cn()` — clsx + tailwind-merge |
| `client/src/lib/csv.ts` | `escapeCSV()`, `buildCSV()` for export/import |
| `client/src/lib/adminUtils.ts` | `transformSectionProgress()` for admin dashboard display |
| `client/src/lib/trpc.ts` | tRPC React client (`createTRPCReact<AppRouter>()`) |
| `client/src/const.ts` | `getLoginUrl()` for OAuth redirect |
| `client/src/_core/hooks/useAuth.ts` | Auth state, logout, redirect on 401 |
| `client/src/hooks/useMobile.tsx` | Mobile viewport detection (< 768px) |
| `client/src/hooks/useComposition.ts` | IME composition event handlers (Asian language input) |
| `client/src/hooks/usePersistFn.ts` | Persistent function reference hook |
| `client/src/contexts/ThemeContext.tsx` | Dark/light theme provider with localStorage |

## Common Change Patterns

### Add a new page
1. Create component in `client/src/pages/NewPage.tsx`
2. Add route in `client/src/App.tsx`
3. Add sidebar link in `client/src/components/DashboardLayout.tsx`

### Add a new API endpoint
1. Create or edit router in `server/routers/`
2. If new router, register it in `server/routers.ts`
3. Call from client via `trpc.routerName.endpointName.useQuery()` or `.useMutation()`

### Add a new database table
1. Define table in `drizzle/schema.ts`
2. Run `npm run db:push` (runs drizzle-kit generate + migrate)
3. Export types from `shared/types.ts` if needed

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
| `dev` | `NODE_ENV=development tsx watch server/_core/index.ts` |
| `build` | `vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist` |
| `start` | `NODE_ENV=production node dist/index.js` |
| `check` | `tsc --noEmit` (type-check) |
| `format` | `prettier --write .` |
| `test` | `vitest run` |
| `db:push` | `drizzle-kit generate && drizzle-kit migrate` |
