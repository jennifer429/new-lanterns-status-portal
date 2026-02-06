# New Lanterns Status Portal - Database Schema

**Last Updated:** February 6, 2026  
**Total Tables:** 12

---

## Core Tables

### 1. **users** (Authentication & User Management)
```sql
- id (int, PK, auto-increment)
- email (varchar 255, unique, not null)
- password (varchar 255, not null) -- bcrypt hashed
- name (varchar 255)
- role (enum: 'admin', 'user', not null)
- organizationId (int, FK → organizations.id)
- lastLoginAt (timestamp)
- resetToken (varchar 255)
- resetTokenExpiry (timestamp)
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, on update now)
- emailVerified (int, default 0) -- boolean
```

### 2. **organizations** (Client Organizations)
```sql
- id (int, PK, auto-increment)
- name (varchar 255, not null)
- slug (varchar 100, unique, not null) -- URL identifier
- contactName (varchar 255)
- contactEmail (varchar 255)
- contactPhone (varchar 50)
- status (enum: 'active', 'inactive', 'pending', default 'active')
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, on update now)

-- Integration IDs (UNUSED - can be removed)
- clickupListId (varchar 255)
- linearIssueId (varchar 255)
- googleDriveFolderId (varchar 255)
- notionDatabaseId (varchar 255)
```
**Note:** Integration fields are no longer used since we removed ClickUp/Linear/Notion integrations.

---

## NEW: Intake Questionnaire Schema

### 3. **questions** (Master Question List - 51 Questions)
```sql
- id (int, PK, auto-increment)
- questionId (varchar 50, unique, not null) -- e.g., "H.1", "D.13"
- sectionId (varchar 50, not null) -- e.g., "org-info", "data-integration"
- sectionTitle (varchar 255, not null) -- e.g., "Organization Information"
- questionNumber (int, not null) -- Sequential within section
- shortTitle (varchar 100, not null) -- For filenames, e.g., "Procedure-Code-List"
- questionText (text, not null) -- Full question text
- questionType (varchar 50, not null) -- text, textarea, dropdown, upload, etc.
- options (text) -- JSON array for dropdown/multi-select
- placeholder (text)
- notes (text)
- required (int, default 0) -- boolean
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, on update now)
```

### 4. **responses** (User Answers with Audit Trail)
```sql
- id (int, PK, auto-increment)
- organizationId (int, FK → organizations.id, not null)
- questionId (int, FK → questions.id, not null)
- response (text) -- User's answer
- fileUrl (text) -- Google Drive link if file uploaded
- userEmail (varchar 255, not null) -- Who answered
- createdAt (timestamp, default now) -- When first answered
- updatedAt (timestamp, default now, on update now) -- Last modified
```
**Key Features:**
- Tracks who answered each question (`userEmail`)
- Tracks when answers were created and last modified
- Links to master questions table (single source of truth)

---

## Legacy Tables (Old Intake System)

### 5. **intakeResponses** (OLD - Being Phased Out)
```sql
- id (int, PK, auto-increment)
- organizationId (int, FK → organizations.id)
- section (varchar 100) -- OLD section format
- questionId (varchar 100)
- response (text)
- fileUrl (text)
- completed (int, default 0)
- completedAt (timestamp)
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, on update now)
```
**Status:** Will be removed after full migration to new `questions` + `responses` schema.

---

## File Management

### 6. **fileAttachments**
```sql
- id (int, PK, auto-increment)
- organizationId (int, FK → organizations.id)
- fileName (varchar 255)
- fileUrl (text)
- fileSize (int)
- mimeType (varchar 100)
- uploadedBy (varchar 255)
- taskId (varchar 100)
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, on update now)
- description (text)
```

### 7. **intakeFileAttachments**
```sql
- id (int, PK, auto-increment)
- organizationId (int, FK → organizations.id)
- questionId (varchar 100)
- fileName (varchar 255)
- fileUrl (text)
- fileSize (int)
- mimeType (varchar 100)
- uploadedBy (varchar 255)
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, on update now)
```

---

## Progress Tracking

### 8. **sectionProgress**
```sql
- id (int, PK, auto-increment)
- organizationId (int, FK → organizations.id)
- sectionName (varchar 100)
- completedTasks (int, default 0)
- totalTasks (int, default 0)
- status (enum: 'not_started', 'in_progress', 'completed', default 'not_started')
- completedAt (timestamp)
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, on update now)
- notes (text)
```

### 9. **taskCompletion**
```sql
- id (int, PK, auto-increment)
- organizationId (int, FK → organizations.id)
- taskId (varchar 100)
- taskName (varchar 255)
- sectionName (varchar 100)
- completed (int, default 0)
- completedAt (timestamp)
- completedBy (varchar 255)
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, on update now)
- notes (text)
```

---

## Communication

### 10. **activityFeed**
```sql
- id (int, PK, auto-increment)
- organizationId (int, FK → organizations.id)
- source (varchar 50) -- e.g., "linear", "manual", "system"
- author (varchar 255)
- message (text)
- createdAt (timestamp, default now)
- metadata (text) -- JSON for additional data
```

---

## Security

### 11. **passwordResetTokens**
```sql
- id (int, PK, auto-increment)
- userId (int, FK → users.id)
- token (varchar 255, unique)
- expiresAt (timestamp)
- used (int, default 0)
- createdAt (timestamp, default now)
- usedAt (timestamp)
```

---

## Summary

**Active Tables:** 12  
**Core Tables:** users, organizations, questions, responses  
**Legacy Tables:** intakeResponses (to be removed)  
**Unused Fields:** clickupListId, linearIssueId, googleDriveFolderId, notionDatabaseId in organizations table

**Recommended Cleanup:**
1. Remove integration fields from organizations table
2. Remove intakeResponses table after confirming all data migrated
3. Consider consolidating fileAttachments and intakeFileAttachments tables
