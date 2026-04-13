# New Lanterns Status Portal - Database Schema

**Last Updated:** April 13, 2026
**Total Tables:** 25
**Source of truth:** `drizzle/schema.ts`

---

## Core Tables

### 1. users

Authentication and user management. Supports OAuth and email/password login.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `openId` | varchar(64) | NO | - | OAuth identifier (unique) |
| `name` | text | YES | NULL | Full name |
| `email` | varchar(320) | YES | NULL | Email address (unique) |
| `passwordHash` | varchar(255) | YES | NULL | bcrypt hash for email/password auth |
| `loginMethod` | varchar(64) | YES | NULL | Auth method (email, google, etc.) |
| `role` | enum('user','admin') | NO | 'user' | Access role |
| `clientId` | int | YES | NULL | Partner assignment (FK to clients.id) |
| `organizationId` | int | YES | NULL | Hospital assignment (FK to organizations.id) |
| `isActive` | tinyint | NO | 1 | 1 = active, 0 = deactivated |
| `invitedAt` | timestamp | YES | NULL | When invite email was sent |
| `inviteToken` | varchar(128) | YES | NULL | One-time set-password token |
| `inviteTokenExpiresAt` | timestamp | YES | NULL | Token expiry |
| `lastLoginAt` | timestamp | YES | NULL | Last login timestamp |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Account creation |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |
| `lastSignedIn` | timestamp | NO | CURRENT_TIMESTAMP | Last sign-in |

### 2. clients

Partner organizations (RadOne, SRV, etc.) — top of the data hierarchy.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `name` | varchar(255) | NO | - | Partner name |
| `slug` | varchar(100) | NO | - | URL-safe identifier (unique) |
| `description` | text | YES | NULL | Optional description |
| `status` | enum('active','inactive') | NO | 'active' | Partner status |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 3. organizations

Clinical facilities (hospitals) under each partner.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `clientId` | int | YES | NULL | Partner assignment (FK to clients.id) |
| `name` | varchar(255) | NO | - | Organization name |
| `slug` | varchar(100) | NO | - | URL-safe identifier (unique) |
| `contactName` | varchar(255) | YES | NULL | Primary contact |
| `contactEmail` | varchar(320) | YES | NULL | Contact email |
| `contactPhone` | varchar(50) | YES | NULL | Contact phone |
| `startDate` | varchar(50) | YES | NULL | Project start date |
| `goalDate` | varchar(50) | YES | NULL | Target completion date |
| `status` | enum('active','completed','paused','inactive') | NO | 'active' | Status |
| `linearIssueId` | varchar(100) | YES | NULL | Linear issue ID |
| `clickupListId` | varchar(100) | YES | NULL | ClickUp list ID |
| `googleDriveFolderId` | varchar(100) | YES | NULL | Google Drive folder ID |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

---

## Intake Form Tables

### 4. questions

Master list of intake form questions (single source of truth).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `questionId` | varchar(50) | NO | - | Human-readable ID, e.g. "H.1" (unique) |
| `sectionId` | varchar(50) | NO | - | Section identifier |
| `sectionTitle` | varchar(255) | NO | - | Section display title |
| `questionNumber` | int | NO | - | Sequential number within section |
| `shortTitle` | varchar(100) | NO | - | Short title for filenames |
| `questionText` | text | NO | - | Full question text |
| `questionType` | varchar(50) | NO | - | Input type (text, textarea, dropdown, date, multi-select, upload) |
| `options` | text | YES | NULL | JSON array of options |
| `placeholder` | text | YES | NULL | Placeholder text |
| `notes` | text | YES | NULL | Additional notes |
| `required` | int | NO | 0 | Required flag (0/1) |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 5. questionOptions

Individual options for dropdown/multi-select questions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `questionId` | int | NO | - | FK to questions.id |
| `optionValue` | varchar(255) | NO | - | Internal value |
| `optionLabel` | varchar(255) | NO | - | Display text |
| `displayOrder` | int | NO | 0 | Sort order |
| `isActive` | int | NO | 1 | Active flag (0/1) |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 6. responses

User answers to questions with audit trail.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `questionId` | int | NO | - | FK to questions.id |
| `response` | text | YES | NULL | Text answer or JSON |
| `fileUrl` | text | YES | NULL | File upload URL |
| `userEmail` | varchar(320) | YES | NULL | Who answered |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | When first answered |
| `updatedAt` | timestamp | NO | ON UPDATE | When last modified |

### 7. intakeResponses (legacy)

Legacy intake responses. Being phased out in favor of `questions` + `responses`.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `questionId` | varchar(50) | NO | - | Question identifier |
| `section` | varchar(255) | NO | - | Section name |
| `response` | text | YES | NULL | Answer text |
| `fileUrl` | text | YES | NULL | File URL |
| `status` | enum('not_started','in_progress','complete') | NO | 'not_started' | Status |
| `updatedBy` | varchar(255) | YES | NULL | Who updated |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 8. intakeFileAttachments

Files uploaded in intake form questions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `questionId` | varchar(50) | NO | - | Question identifier |
| `fileName` | varchar(255) | NO | - | Original filename |
| `fileUrl` | text | NO | - | Google Drive/S3 URL |
| `driveFileId` | varchar(500) | YES | NULL | Drive file ID or S3 key |
| `fileSize` | int | YES | NULL | Bytes |
| `mimeType` | varchar(100) | YES | NULL | MIME type |
| `uploadedBy` | varchar(255) | YES | NULL | User email |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Upload time |

---

## File Management

### 9. fileAttachments

File metadata for implementation tasks (S3 storage).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `taskId` | varchar(50) | NO | - | Task identifier |
| `fileName` | varchar(255) | NO | - | Original filename |
| `fileUrl` | text | NO | - | S3 URL |
| `fileKey` | varchar(500) | NO | - | S3 key |
| `fileSize` | int | YES | NULL | Bytes |
| `mimeType` | varchar(100) | YES | NULL | MIME type |
| `uploadedBy` | varchar(255) | YES | NULL | User email |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Upload time |

### 10. partnerTemplates

Downloadable template files scoped to a partner (client). Shown on intake form for matching question.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `clientId` | int | NO | - | FK to clients.id |
| `questionId` | varchar(50) | NO | - | Intake question ID |
| `label` | varchar(255) | NO | - | Display name |
| `fileName` | varchar(255) | NO | - | Original filename |
| `fileUrl` | text | NO | - | S3 URL |
| `s3Key` | varchar(500) | NO | - | S3 key |
| `fileSize` | int | YES | NULL | Bytes |
| `mimeType` | varchar(100) | YES | NULL | MIME type |
| `uploadedBy` | varchar(320) | YES | NULL | Admin email |
| `isActive` | tinyint | NO | 1 | Active flag |
| `deactivatedBy` | varchar(320) | YES | NULL | Who deactivated |
| `deactivatedAt` | timestamp | YES | NULL | When deactivated |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 11. specifications

Global spec documents uploaded by admins, visible to all logged-in users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `title` | varchar(255) | NO | - | Display title |
| `description` | text | YES | NULL | Optional description |
| `category` | varchar(100) | YES | NULL | Grouping category |
| `fileName` | varchar(255) | NO | - | Original filename |
| `fileUrl` | text | NO | - | S3 URL |
| `s3Key` | varchar(500) | NO | - | S3 key |
| `fileSize` | int | YES | NULL | Bytes |
| `mimeType` | varchar(100) | YES | NULL | MIME type |
| `uploadedBy` | varchar(320) | YES | NULL | Admin email |
| `isActive` | tinyint | NO | 1 | Active flag |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 12. partnerDocuments

Procedural library — operational docs uploaded by partners, visible to their orgs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `clientId` | int | NO | - | FK to clients.id |
| `categoryId` | int | YES | NULL | Category reference |
| `title` | varchar(500) | NO | - | Document title |
| `description` | text | YES | NULL | Description |
| `filename` | varchar(500) | NO | - | Original filename |
| `driveFileId` | varchar(255) | YES | NULL | Google Drive file ID |
| `url` | varchar(2000) | NO | - | Google Drive URL |
| `mimeType` | varchar(255) | NO | - | MIME type |
| `size` | int | NO | - | File size in bytes |
| `uploadedById` | int | NO | - | FK to users.id |
| `uploadedByName` | varchar(255) | NO | - | Uploader display name |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Upload time |

### 13. orgNotes

Labeled file uploads from org/partner dashboards (call notes, templates, references).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | YES | NULL | FK to organizations.id (null for partner-level) |
| `clientId` | int | YES | NULL | FK to clients.id |
| `label` | varchar(100) | NO | 'General' | File label |
| `fileName` | varchar(255) | NO | - | Original filename |
| `fileUrl` | text | NO | - | File URL |
| `driveFileId` | varchar(500) | YES | NULL | Drive file ID |
| `fileSize` | int | YES | NULL | Bytes |
| `mimeType` | varchar(100) | YES | NULL | MIME type |
| `uploadedBy` | varchar(255) | YES | NULL | User email |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Upload time |

---

## Progress Tracking

### 14. sectionProgress

Completion status per checklist section.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `sectionName` | varchar(255) | NO | - | Section name |
| `status` | enum('pending','in-progress','complete') | NO | 'pending' | Status |
| `progress` | int | NO | 0 | Percentage (0-100) |
| `expectedEnd` | varchar(50) | YES | NULL | Expected completion |
| `actualEnd` | varchar(50) | YES | NULL | Actual completion |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 15. taskCompletion

Per-task completion and status tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `sectionName` | varchar(255) | NO | - | Section name |
| `taskId` | varchar(50) | NO | - | Task identifier |
| `completed` | int | NO | 0 | Completed flag (0/1) |
| `notApplicable` | int | NO | 0 | N/A flag (excluded from counts) |
| `inProgress` | int | NO | 0 | In-progress flag |
| `blocked` | int | NO | 0 | Blocked flag |
| `completedAt` | timestamp | YES | NULL | Completion time |
| `completedBy` | varchar(255) | YES | NULL | Who completed |
| `targetDate` | varchar(20) | YES | NULL | Due date (YYYY-MM-DD) |
| `notes` | text | YES | NULL | Notes |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 16. validationResults

Mutable test state per organization. Phase/test definitions in `shared/validationPhases.ts`.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `testKey` | varchar(20) | NO | - | Stable key: "phaseIndex:testIndex" |
| `actual` | text | YES | NULL | Actual result |
| `status` | enum('Pass','Fail','Not Tested','Pending','N/A','In Progress','Blocked') | NO | 'Not Tested' | Test status |
| `signOff` | varchar(255) | YES | NULL | Sign-off name |
| `notes` | text | YES | NULL | Notes |
| `testedDate` | varchar(10) | YES | NULL | YYYY-MM-DD |
| `updatedBy` | varchar(320) | YES | NULL | Who updated |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 17. partnerTaskTemplates

Reusable task definitions created by partner admins, shown on tasks page for their orgs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `clientId` | int | NO | - | FK to clients.id |
| `title` | varchar(255) | NO | - | Task title |
| `description` | text | YES | NULL | Description |
| `type` | varchar(50) | NO | 'review' | Task type (upload/schedule/form/review) |
| `section` | varchar(255) | YES | NULL | Section grouping |
| `sortOrder` | int | NO | 0 | Display order |
| `isActive` | tinyint | NO | 1 | Active flag |
| `createdBy` | varchar(320) | YES | NULL | Creator email |
| `updatedBy` | varchar(320) | YES | NULL | Last updater |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 18. orgCustomTasks

Org-specific custom tasks added by hospital users (does not affect partner template).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `title` | varchar(255) | NO | - | Task title |
| `description` | text | YES | NULL | Description |
| `type` | varchar(50) | NO | 'review' | Task type |
| `section` | varchar(255) | YES | NULL | Section grouping |
| `isComplete` | tinyint | NO | 0 | Completion flag |
| `createdBy` | varchar(320) | YES | NULL | Creator email |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

---

## Activity & Feedback

### 19. activityFeed

Updates from integrations (Linear/ClickUp) and manual entries.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `source` | enum('linear','clickup','manual') | NO | - | Update source |
| `sourceId` | varchar(100) | YES | NULL | External ID |
| `author` | varchar(255) | YES | NULL | Author name |
| `message` | text | NO | - | Message content |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |

### 20. onboardingFeedback

User ratings and comments about the intake experience.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `rating` | int | NO | - | 1-5 stars |
| `comments` | text | YES | NULL | User comments |
| `submittedBy` | varchar(320) | YES | NULL | User email |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Submission time |

---

## Vendor Management

### 21. systemVendorOptions

Admin-configurable picklist for system types (PACS, VNA, EHR, AI, Reporting).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `systemType` | varchar(100) | NO | - | System category |
| `vendorName` | varchar(255) | NO | - | Vendor name |
| `displayOrder` | int | NO | 0 | Sort order |
| `isActive` | tinyint | NO | 1 | Active flag |
| `createdBy` | varchar(320) | YES | NULL | Creator email |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |
| `updatedAt` | timestamp | NO | ON UPDATE | Last update |

### 22. vendorAuditLog

Audit trail for vendor picklist changes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `action` | varchar(50) | NO | - | Action type (add/update/toggle/delete/seed) |
| `systemType` | varchar(100) | NO | - | System category |
| `vendorName` | varchar(255) | YES | NULL | Affected vendor |
| `previousValue` | text | YES | NULL | Before state |
| `newValue` | text | YES | NULL | After state |
| `performedBy` | varchar(320) | NO | - | Admin email |
| `performedAt` | timestamp | NO | CURRENT_TIMESTAMP | When performed |

---

## Authentication

### 23. passwordResetTokens

Temporary tokens for password reset flow.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `userId` | int | NO | - | FK to users.id |
| `token` | varchar(255) | NO | - | Reset token (unique) |
| `expiresAt` | timestamp | NO | - | Token expiration |
| `used` | int | NO | 0 | Used flag (0/1) |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation time |

---

## AI & Audit

### 24. aiAuditLogs

Logs for all AI assistant actions (chat, tool calls, data mutations).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `action` | varchar(100) | NO | - | Tool/action name |
| `category` | enum('chat','read','write','navigate','extract') | NO | - | High-level category |
| `actorId` | int | YES | NULL | FK to users.id |
| `actorEmail` | varchar(320) | YES | NULL | User email |
| `actorRole` | varchar(50) | YES | NULL | User role |
| `clientId` | int | YES | NULL | FK to clients.id |
| `organizationId` | int | YES | NULL | Target org |
| `organizationSlug` | varchar(100) | YES | NULL | Org slug |
| `targetUserId` | int | YES | NULL | Target user |
| `targetUserEmail` | varchar(320) | YES | NULL | Target email |
| `userPrompt` | text | YES | NULL | User's input |
| `aiResponse` | text | YES | NULL | AI response text |
| `toolArgs` | text | YES | NULL | Tool call args (JSON) |
| `toolResult` | text | YES | NULL | Tool result (JSON) |
| `status` | enum('success','error','denied') | NO | 'success' | Outcome |
| `errorMessage` | text | YES | NULL | Error if failed |
| `ipAddress` | varchar(45) | YES | NULL | Request IP |
| `durationMs` | int | YES | NULL | Duration in ms |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | When logged |

### 25. partnerDocAudit

Audit trail for procedural library document access.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `documentId` | int | NO | - | FK to partnerDocuments.id |
| `userId` | int | NO | - | FK to users.id |
| `userName` | varchar(255) | NO | - | Display name |
| `userEmail` | varchar(320) | NO | - | User email |
| `action` | enum('upload','view','download') | NO | - | Action type |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | When performed |

---

## Relationships

```
clients (1) ──< organizations (N)
                     │
                     ├──< users (N)
                     ├──< responses (N)
                     ├──< intakeFileAttachments (N)
                     ├──< fileAttachments (N)
                     ├──< sectionProgress (N)
                     ├──< taskCompletion (N)
                     ├──< validationResults (N)
                     ├──< activityFeed (N)
                     ├──< onboardingFeedback (N)
                     ├──< orgNotes (N)
                     └──< orgCustomTasks (N)

clients (1) ──< partnerTemplates (N)
clients (1) ──< partnerTaskTemplates (N)
clients (1) ──< partnerDocuments (N)
clients (1) ──< orgNotes (N)  [partner-level]

questions (1) ──< questionOptions (N)
questions (1) ──< responses (N)

users (1) ──< passwordResetTokens (N)

partnerDocuments (1) ──< partnerDocAudit (N)
```
