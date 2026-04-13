# Data Dictionary

Complete database schema documentation for the New Lantern PACS Onboarding Status Portal.

> **Note:** For a compact column-level reference, see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) (25 tables).
> The source of truth is always `drizzle/schema.ts`.

## Table of Contents

- [Core Tables](#core-tables)
  - [users](#users)
  - [clients](#clients)
  - [organizations](#organizations)
- [Intake Form Tables](#intake-form-tables)
  - [questions](#questions)
  - [questionOptions](#questionoptions)
  - [responses](#responses)
  - [intakeFileAttachments](#intakefileattachments)
- [File Management](#file-management)
  - [fileAttachments](#fileattachments)
  - [partnerTemplates](#partnertemplates)
  - [specifications](#specifications)
  - [partnerDocuments](#partnerdocuments)
  - [orgNotes](#orgnotes)
- [Progress Tracking](#progress-tracking)
  - [sectionProgress](#sectionprogress)
  - [taskCompletion](#taskcompletion)
  - [validationResults](#validationresults)
  - [partnerTaskTemplates](#partnertasktemplates)
  - [orgCustomTasks](#orgcustomtasks)
- [Activity & Feedback](#activity--feedback)
  - [activityFeed](#activityfeed)
  - [onboardingFeedback](#onboardingfeedback)
- [Vendor Management](#vendor-management)
  - [systemVendorOptions](#systemvendoroptions)
  - [vendorAuditLog](#vendorauditlog)
- [Authentication](#authentication)
  - [passwordResetTokens](#passwordresettokens)
- [AI & Audit](#ai--audit)
  - [aiAuditLogs](#aiauditlogs)
  - [partnerDocAudit](#partnerdocaudit)
- [Legacy](#legacy)
  - [intakeResponses](#intakeresponses)

---

## Core Tables

### users

Stores all user accounts with role-based access control and partner assignment.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `openId` | varchar(64) | NO | - | OAuth identifier (unique) |
| `name` | text | YES | NULL | User's full name |
| `email` | varchar(320) | YES | NULL | User's email address |
| `passwordHash` | varchar(255) | YES | NULL | bcrypt hash for email/password auth |
| `loginMethod` | varchar(64) | YES | NULL | Authentication method (email, google, etc.) |
| `role` | enum('user', 'admin') | NO | 'user' | User role for access control |
| **`clientId`** | int | YES | NULL | **Partner assignment** (FK to clients.id) |
| `organizationId` | int | YES | NULL | Hospital assignment (FK to organizations.id) |
| `lastLoginAt` | timestamp | YES | NULL | Last login timestamp |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Account creation timestamp |
| `updatedAt` | timestamp | NO | CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |
| `lastSignedIn` | timestamp | NO | CURRENT_TIMESTAMP | Last sign-in timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`openId`)
- KEY (`email`)
- KEY (`clientId`) - For partner filtering

**Partner Isolation:**
- `clientId` determines which partner the user belongs to
- NULL `clientId` = New Lantern staff (platform admin)
- Non-NULL `clientId` = Partner admin or hospital user

---

### clients

Represents partner organizations (RadOne, SRV, etc.) at the top level of the hierarchy.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `name` | varchar(255) | NO | - | Partner name (e.g., "RadOne", "SRV") |
| `slug` | varchar(100) | NO | - | URL-safe identifier (unique) |
| `description` | text | YES | NULL | Optional description |
| `status` | enum('active', 'inactive') | NO | 'active' | Partner status |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation timestamp |
| `updatedAt` | timestamp | NO | CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`slug`)

**Current Partners:**
- ID 1: RadOne
- ID 2: SRV

---

### organizations

Represents clinical organizations (hospitals/facilities) that belong to a partner.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **`clientId`** | int | YES | NULL | **Partner assignment** (FK to clients.id) |
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `name` | varchar(255) | NO | - | Organization name |
| `slug` | varchar(100) | NO | - | URL-safe identifier (unique) |
| `contactName` | varchar(255) | YES | NULL | Primary contact name |
| `contactEmail` | varchar(320) | YES | NULL | Primary contact email |
| `contactPhone` | varchar(50) | YES | NULL | Primary contact phone |
| `startDate` | varchar(50) | YES | NULL | Project start date |
| `goalDate` | varchar(50) | YES | NULL | Target completion date |
| `status` | enum('active', 'completed', 'paused', 'inactive') | NO | 'active' | Organization status |
| `linearIssueId` | varchar(100) | YES | NULL | Linear issue ID for two-way sync |
| `clickupListId` | varchar(100) | YES | NULL | ClickUp list ID for tasks |
| `googleDriveFolderId` | varchar(100) | YES | NULL | Google Drive folder ID |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation timestamp |
| `updatedAt` | timestamp | NO | CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`slug`)
- KEY (`clientId`) - **Critical for partner isolation**

**Partner Isolation:**
- ALL queries MUST filter by `clientId`
- Partner admins can only see organizations where `clientId` matches their assigned partner

---

## Intake Form Tables

### questions

Master list of all intake form questions (single source of truth).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `questionId` | varchar(50) | NO | - | Human-readable ID (e.g., "H.1", "A.7") (unique) |
| `sectionId` | varchar(50) | NO | - | Section identifier (e.g., "org-info") |
| `sectionTitle` | varchar(255) | NO | - | Section title (e.g., "Organization Information") |
| `questionNumber` | int | NO | - | Sequential number within section |
| `shortTitle` | varchar(100) | NO | - | Short title for filenames |
| `questionText` | text | NO | - | Full question text |
| `questionType` | varchar(50) | NO | - | Input type (text, textarea, dropdown, date, multi-select, upload) |
| `options` | text | YES | NULL | JSON array of options for dropdown/multi-select |
| `placeholder` | text | YES | NULL | Placeholder text |
| `notes` | text | YES | NULL | Additional notes/instructions |
| `required` | int | NO | 0 | Required flag (0 = optional, 1 = required) |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation timestamp |
| `updatedAt` | timestamp | NO | CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`questionId`)
- KEY (`sectionId`)

**Current Question Count:** 51 questions across 6 sections

---

### questionOptions

Individual options for dropdown and multi-select questions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `questionId` | int | NO | - | FK to questions.id |
| `optionValue` | varchar(255) | NO | - | Internal value (e.g., "eastern") |
| `optionLabel` | varchar(255) | NO | - | Display text (e.g., "Eastern Time") |
| `displayOrder` | int | NO | 0 | Order in dropdown (1, 2, 3...) |
| `isActive` | int | NO | 1 | Active flag (0 = disabled, 1 = active) |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation timestamp |
| `updatedAt` | timestamp | NO | CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`questionId`)

---

### responses

Stores user answers to questions with audit trail.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `questionId` | int | NO | - | FK to questions.id |
| `response` | text | YES | NULL | Text answer or JSON for complex responses |
| `fileUrl` | text | YES | NULL | For file uploads |
| `userEmail` | varchar(320) | YES | NULL | Who provided this response |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | When first answered |
| `updatedAt` | timestamp | NO | CURRENT_TIMESTAMP ON UPDATE | When last modified |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`organizationId`, `questionId`) - Composite index for fast lookups

**Partner Isolation:**
- Filtered via JOIN with organizations table on `organizationId`

---

### intakeFileAttachments

Stores files uploaded in intake form questions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `questionId` | varchar(50) | NO | - | Question identifier |
| `fileName` | varchar(255) | NO | - | Original filename |
| `fileUrl` | text | NO | - | Google Drive shareable link or S3 URL |
| `driveFileId` | varchar(500) | YES | NULL | Google Drive file ID or S3 key |
| `fileSize` | int | YES | NULL | File size in bytes |
| `mimeType` | varchar(100) | YES | NULL | MIME type |
| `uploadedBy` | varchar(255) | YES | NULL | User email |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Upload timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`organizationId`)

**Partner Isolation:**
- Filtered via JOIN with organizations table on `organizationId`

---

## Progress Tracking

### sectionProgress

Stores completion status for each checklist section.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `sectionName` | varchar(255) | NO | - | Section name |
| `status` | enum('pending', 'in-progress', 'complete') | NO | 'pending' | Section status |
| `progress` | int | NO | 0 | Progress percentage (0-100) |
| `expectedEnd` | varchar(50) | YES | NULL | Expected completion date |
| `actualEnd` | varchar(50) | YES | NULL | Actual completion date |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation timestamp |
| `updatedAt` | timestamp | NO | CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`organizationId`)

---

### taskCompletion

Stores which tasks are completed.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `sectionName` | varchar(255) | NO | - | Section name |
| `taskId` | varchar(50) | NO | - | Task identifier |
| `completed` | int | NO | 0 | Completion flag (0 or 1) |
| `completedAt` | timestamp | YES | NULL | Completion timestamp |
| `completedBy` | varchar(255) | YES | NULL | User who completed |
| `notes` | text | YES | NULL | Completion notes |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation timestamp |
| `updatedAt` | timestamp | NO | CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`organizationId`, `taskId`)

---

## Activity & Feedback

### activityFeed

Stores updates from Linear/ClickUp for client visibility.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `source` | enum('linear', 'clickup', 'manual') | NO | - | Update source |
| `sourceId` | varchar(100) | YES | NULL | Linear issue ID or ClickUp task ID |
| `author` | varchar(255) | YES | NULL | Update author |
| `message` | text | NO | - | Update message |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`organizationId`)

---

### onboardingFeedback

Stores user ratings and comments about the intake experience.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `organizationId` | int | NO | - | FK to organizations.id |
| `rating` | int | NO | - | Rating (1-5 stars) |
| `comments` | text | YES | NULL | User comments |
| `submittedBy` | varchar(320) | YES | NULL | User email |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Submission timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- KEY (`organizationId`)

---

## Authentication

### passwordResetTokens

Stores temporary tokens for password reset flow.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | int | NO | AUTO_INCREMENT | Primary key |
| `userId` | int | NO | - | FK to users.id |
| `token` | varchar(255) | NO | - | Reset token (unique) |
| `expiresAt` | timestamp | NO | - | Token expiration |
| `used` | int | NO | 0 | Used flag (0 or 1) |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`token`)
- KEY (`userId`)

---

## Relationships

```
clients (1) ──< organizations (N)
                     │
                     ├──< users (N)
                     ├──< responses (N)
                     ├──< intakeFileAttachments (N)
                     ├──< sectionProgress (N)
                     ├──< taskCompletion (N)
                     ├──< activityFeed (N)
                     └──< onboardingFeedback (N)

questions (1) ──< questionOptions (N)
questions (1) ──< responses (N)

users (1) ──< passwordResetTokens (N)
```

---

## Partner Isolation Implementation

### Critical Fields

- **`users.clientId`**: Determines which partner the user belongs to
- **`organizations.clientId`**: Determines which partner owns the organization

### Query Patterns

**Partner Admin Query:**
```sql
SELECT * FROM organizations WHERE clientId = ?
```

**Platform Admin Query:**
```sql
SELECT * FROM organizations  -- No filter
```

**Filtered Responses Query:**
```sql
SELECT r.* FROM responses r
JOIN organizations o ON r.organizationId = o.id
WHERE o.clientId = ?
```

### Auto-Assignment Logic

When creating organizations:
```typescript
// Determine clientId from user's email domain
if (email.endsWith('@srv.com')) clientId = 2;
else if (email.endsWith('@radone.com')) clientId = 1;
else if (email.endsWith('@newlantern.ai')) clientId = null; // Platform admin
```

---

## Indexes for Performance

### Critical Indexes

1. **`organizations.clientId`** - Enables fast partner filtering
2. **`users.clientId`** - Enables fast user filtering by partner
3. **`responses (organizationId, questionId)`** - Composite index for intake form queries
4. **`intakeFileAttachments.organizationId`** - Fast file lookups

### Recommended Additional Indexes

```sql
-- For activity feed queries
CREATE INDEX idx_activityFeed_org_created ON activityFeed(organizationId, createdAt DESC);

-- For progress tracking
CREATE INDEX idx_sectionProgress_org_status ON sectionProgress(organizationId, status);

-- For user lookups
CREATE INDEX idx_users_email ON users(email);
```

---

## Data Integrity Rules

1. **Foreign Keys**: All `organizationId` references MUST point to valid organizations
2. **Client Assignment**: Organizations MUST have a `clientId` (except legacy data)
3. **User Roles**: Admin users MUST have either `clientId` (partner admin) or NULL (platform admin)
4. **Question Responses**: Responses MUST reference valid question IDs
5. **File References**: File URLs MUST be valid S3 or Google Drive URLs

---

## Migration Notes

### Adding a New Partner

```sql
-- 1. Insert client record
INSERT INTO clients (name, slug, description, status) 
VALUES ('NewPartner', 'NewPartner', 'Description', 'active');

-- 2. Update existing organizations (if needed)
UPDATE organizations SET clientId = <new_client_id> WHERE slug LIKE 'newpartner-%';

-- 3. Update existing users (if needed)
UPDATE users SET clientId = <new_client_id> WHERE email LIKE '%@newpartner.com';
```

### Backfilling clientId

If you have organizations without `clientId`:

```sql
-- Identify orphaned organizations
SELECT * FROM organizations WHERE clientId IS NULL;

-- Assign to default partner
UPDATE organizations SET clientId = 1 WHERE clientId IS NULL;
```

---

## Backup & Recovery

### Critical Tables (Priority 1)
- `users` - User accounts and access control
- `clients` - Partner definitions
- `organizations` - Hospital data
- `responses` - Intake form answers

### Important Tables (Priority 2)
- `questions` - Question definitions
- `intakeFileAttachments` - File metadata
- `sectionProgress` - Progress tracking

### Recoverable Tables (Priority 3)
- `activityFeed` - Can be re-synced from Linear/ClickUp
- `onboardingFeedback` - Nice to have, not critical

---

## Performance Considerations

### Query Optimization

1. **Always use indexes**: Ensure `clientId` filters use indexes
2. **Avoid N+1 queries**: Use JOINs instead of multiple queries
3. **Paginate large results**: Limit results to 50-100 per page
4. **Cache frequently accessed data**: Cache question definitions

### Database Sizing

- **Expected growth**: ~30 organizations/year
- **Average responses per org**: ~51 questions = 51 rows
- **File attachments**: ~10-20 files per organization
- **Estimated annual growth**: ~10MB data + file storage

---

## Security Notes

### Sensitive Data

- **Password hashes**: NEVER log or expose
- **Email addresses**: PII - handle with care
- **File URLs**: May contain sensitive configuration data

### Access Control

- **Row-level security**: Enforced via `clientId` filtering
- **Column-level security**: No sensitive columns exposed to frontend
- **Audit trail**: All responses include `userEmail` and timestamps

---

For implementation details, see [TENANCY.md](./TENANCY.md).
