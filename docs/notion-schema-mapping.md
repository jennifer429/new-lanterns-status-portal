# Notion Schema Mapping — Complete Property Reference

**Last Updated:** June 1, 2026
**Author:** Manus AI

This document provides the complete mapping between every sync function in `server/notionDualWrite.ts`, its Notion database, and the exact properties written. Use this as the authoritative reference when adding or modifying sync functions.

---

## Sync Function Registry

| Sync Function | MySQL Table | Notion Data Source ID |
|---|---|---|
| `syncAiChatLog` | `aiAuditLogs` | `27f0a0d3-7e20-4f99-9506-41cb6acfb98d` |
| `syncActivityFeed` | `activityFeed` | `1c9c7f8a-82ac-4fd0-a7aa-52d92cdacfdf` |
| `syncOrgNote` | `orgNotes` | `1837f3d2-3a74-4e78-8888-798e8d23dc33` |
| `syncPartnerDocument` | `partnerDocuments` | `a3716243-11e8-4c53-a0e9-3b5c019aa28b` |
| `syncOnboardingFeedback` | `onboardingFeedback` | `b519faba-846a-4bc7-9cbe-3544e9f2358e` |
| `syncOrgCustomTask` | `orgCustomTasks` | `630e0031-9828-4a93-a878-cf032a3913b0` |
| `syncSectionProgress` | `sectionProgress` | `e5aff821-8b35-41a2-aa10-88233292a557` |
| `syncVendorAudit` | `vendorAuditLog` | `5362ba9e-2a06-41b6-837e-3fee788645f9` |
| `syncTaskFile` | `fileAttachments` | `6a91a46b-92c8-4993-a438-9be52d99091f` |
| `syncIntakeFile` | `intakeFileAttachments` | `f6686c03-774e-4199-9b9f-2a32b147dee0` |
| `syncPartnerTemplate` | `partnerTemplates` | `a3a6d9e2-821f-4457-9a0b-d950a552c069` |
| `syncPartnerTaskTemplate` | `partnerTaskTemplates` | `7e465daf-309e-4a40-9da4-c31c5581159a` |
| `syncSpecification` | `specifications` | `92898821-46a9-4b99-8d26-b9f46b966bec` |
| `syncSystemVendor` | `systemVendorOptions` | `f213558d-f91e-4015-95b5-275e6760fbf6` |
| `syncQuestion` | `questions` | `d3b05f91-8472-4df1-82af-e0cf8e63b952` |
| `syncQuestionOption` | `question_options` | `f1f8494c-7bb6-4564-aced-6177f48b9006` |
| `syncPortalUser` | `users` | `6e3c6e66-e664-494a-b678-02dc2b82d431` |
| `syncClient` | `clients` | `f03477c2-bfd1-4266-b6b5-f5409760759b` |
| `syncOrganization` | `organizations` | `cbfdc89f-56b8-46d4-97ec-bb7f186baa85` |
| `syncImplementationOrg` | `implementationOrgs` | `4faa1bc2-f55e-42b2-b85f-51bb0f29d437` |
| `syncPartnerDocAudit` | `partnerDocAudit` | `a3716243-11e8-4c53-a0e9-3b5c019aa28b` |

---

## Property Mappings

### `syncAiChatLog`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `{userEmail} - {date}` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| User Email | rich_text | `payload.userEmail` |
| User Role | rich_text | `payload.userRole` |
| Prompt | rich_text | `payload.prompt` |
| Response | rich_text | `payload.response` |
| Model | rich_text | `payload.model` |
| Tokens Used | number | `payload.tokensUsed` |
| Tool Calls | rich_text | `payload.toolCalls` |
| Created At | date | `payload.createdAt` |

### `syncActivityFeed`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `{eventType} - {actor} - {date}` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| Event Type | rich_text | `payload.eventType` |
| Actor | rich_text | `payload.actor` |
| Description | rich_text | `payload.description` |
| Created At | date | `payload.createdAt` |

### `syncOrgNote`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.title` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| Client ID | number | `payload.clientId` |
| Label | rich_text | `payload.label` |
| File URL | rich_text | `payload.fileUrl` |
| Drive File ID | rich_text | `payload.driveFileId` |
| File Size | number | `payload.fileSize` |
| MIME Type | rich_text | `payload.mimeType` |
| Uploaded By | rich_text | `payload.uploadedBy` |
| Created At | date | `payload.createdAt` |

### `syncPartnerDocument`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.title` (fileName) |
| Client ID | number | `payload.clientId` |
| Partner | rich_text | `payload.partnerName` |
| File Name | rich_text | `payload.fileName` |
| File URL | rich_text | `payload.fileUrl` |
| Drive File ID | rich_text | `payload.driveFileId` |
| MIME Type | rich_text | `payload.mimeType` |
| File Size | number | `payload.fileSize` |
| Category | rich_text | `payload.category` |
| Uploaded By | rich_text | `payload.uploadedBy` |
| Active | rich_text | `payload.active` |
| Created At | date | `payload.createdAt` |

### `syncOnboardingFeedback`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `{orgName} - {date}` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| Rating | number | `payload.rating` |
| Comments | rich_text | `payload.comments` |
| Submitted By | rich_text | `payload.submittedBy` |
| Created At | date | `payload.createdAt` |

### `syncOrgCustomTask`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.taskName` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| Task ID | rich_text | `payload.taskId` |
| Section | rich_text | `payload.section` |
| Description | rich_text | `payload.description` |
| Owner | rich_text | `payload.owner` |
| Status | rich_text | `payload.status` |
| Created By | rich_text | `payload.createdBy` |
| Created At | date | `payload.createdAt` |

### `syncSectionProgress`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.sectionName` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| Section Name | rich_text | `payload.sectionName` |
| Status | rich_text | `payload.status` |
| Progress | number | `payload.progress` |
| Expected End | rich_text | `payload.expectedEnd` |
| Updated At | date | `payload.updatedAt` |

### `syncVendorAudit`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.action` |
| Vendor ID | number | `payload.vendorId` |
| Action | rich_text | `payload.action` |
| Field | rich_text | `payload.field` |
| Old Value | rich_text | `payload.oldValue` |
| New Value | rich_text | `payload.newValue` |
| Performed By | rich_text | `payload.performedBy` |
| Created At | date | `payload.createdAt` |

### `syncTaskFile`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.fileName` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| Task ID | rich_text | `payload.taskId` |
| File URL | rich_text | `payload.fileUrl` |
| Drive File ID | rich_text | `payload.driveFileId` |
| File Size | number | `payload.fileSize` |
| MIME Type | rich_text | `payload.mimeType` |
| Uploaded By | rich_text | `payload.uploadedBy` |
| Created At | date | `payload.createdAt` |

### `syncIntakeFile`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.fileName` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| Question ID | rich_text | `payload.questionId` |
| File URL | rich_text | `payload.fileUrl` |
| Drive File ID | rich_text | `payload.driveFileId` |
| File Size | number | `payload.fileSize` |
| MIME Type | rich_text | `payload.mimeType` |
| Uploaded By | rich_text | `payload.uploadedBy` |
| Created At | date | `payload.createdAt` |

### `syncPartnerTemplate`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.title` (fileName) |
| Client ID | number | `payload.clientId` |
| Partner | rich_text | `payload.partnerName` |
| Question ID | rich_text | `payload.questionId` |
| File Name | rich_text | `payload.fileName` |
| File URL | rich_text | `payload.fileUrl` |
| MIME Type | rich_text | `payload.mimeType` |
| File Size | number | `payload.fileSize` |
| Active | rich_text | `payload.active` |
| Uploaded By | rich_text | `payload.uploadedBy` |
| Created At | date | `payload.createdAt` |

### `syncPartnerTaskTemplate`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.title` (taskName) |
| Client ID | number | `payload.clientId` |
| Partner | rich_text | `payload.partnerName` |
| Task ID | rich_text | `payload.taskId` |
| Section | rich_text | `payload.section` |
| Description | rich_text | `payload.description` |
| Owner | rich_text | `payload.owner` |
| Active | rich_text | `payload.active` |
| Created By | rich_text | `payload.createdBy` |
| Created At | date | `payload.createdAt` |

### `syncSpecification`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.title` |
| Key | rich_text | `payload.key` |
| Description | rich_text | `payload.description` |
| Category | rich_text | `payload.category` |
| Active | rich_text | `payload.active` |
| Created At | date | `payload.createdAt` |

### `syncSystemVendor`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.vendorName` |
| System Type | rich_text | `payload.systemType` |
| Vendor Name | rich_text | `payload.vendorName` |
| Product Name | rich_text | `payload.productName` |
| Active | rich_text | `payload.active` |
| Created At | date | `payload.createdAt` |

### `syncQuestion`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.label` |
| Key | rich_text | `payload.key` |
| Section | rich_text | `payload.section` |
| Type | rich_text | `payload.type` |
| Required | rich_text | `payload.required` |
| Active | rich_text | `payload.active` |
| Sort Order | number | `payload.sortOrder` |
| Full Text | rich_text | `payload.fullText` |
| Created At | date | `payload.createdAt` |

### `syncQuestionOption`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.label` |
| Question ID | number | `payload.questionId` |
| Question Key | rich_text | `payload.questionKey` |
| Value | rich_text | `payload.value` |
| Sort Order | number | `payload.sortOrder` |
| Created At | date | `payload.createdAt` |

### `syncPortalUser`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.name` |
| Email | rich_text | `payload.email` |
| Role | rich_text | `payload.role` |
| Client ID | number | `payload.clientId` |
| Partner | rich_text | `payload.partnerName` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| Active | rich_text | `payload.active` |
| Last Login | date | `payload.lastLogin` |
| Created At | date | `payload.createdAt` |

### `syncClient`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.name` |
| Slug | rich_text | `payload.slug` |
| Contact Name | rich_text | `payload.contactName` |
| Contact Email | rich_text | `payload.contactEmail` |
| Active | rich_text | `payload.active` |
| Org Count | number | `payload.orgCount` |
| Created At | date | `payload.createdAt` |

### `syncOrganization`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.name` |
| Slug | rich_text | `payload.slug` |
| Client ID | number | `payload.clientId` |
| Partner | rich_text | `payload.partnerName` |
| Contact Name | rich_text | `payload.contactName` |
| Contact Email | rich_text | `payload.contactEmail` |
| Contact Phone | rich_text | `payload.contactPhone` |
| Status | rich_text | `payload.status` |
| Start Date | date | `payload.startDate` |
| Goal Date | date | `payload.goalDate` |
| Drive Folder ID | rich_text | `payload.driveFolderId` |
| Created At | date | `payload.createdAt` |

### `syncImplementationOrg`

| Notion Property | Notion Type | Source |
|---|---|---|
| Name (title) | title | `payload.name` |
| Organization ID | number | `payload.organizationId` |
| Organization | rich_text | `payload.orgName` |
| Created At | date | `payload.createdAt` |

---

## Standard Properties (Auto-Added to All Databases)

Every Notion database in this system has these standard properties managed by `upsertPage`:

| Property | Type | Value |
|---|---|---|
| MySQL ID | number | Primary key from MySQL |
| Last Updated From | select | Always "Portal" |
| Last Synced | date | Timestamp of last successful sync |

---

## Retry Queue Behavior

| Parameter | Value |
|---|---|
| Max retries | 3 |
| Backoff | Exponential |
| Replay interval | Every 5 minutes (cron) |
| Batch size | 20 per cycle |
| On permanent failure | Marked `failed_permanent`, owner notified |
| Payload storage | Full original sync payload preserved via `originalPayload` |

---

## Audit: June 1, 2026

**Issue found:** All 20 Notion databases were missing the custom properties that the sync code writes. Only the standard properties (Name, MySQL ID, Last Updated From, Last Synced) existed.

**Root cause:** Databases were created with only basic columns; the sync code assumed columns existed but they were never added.

**Resolution:** All 155 missing columns added to all 20 databases via `notion-update-data-source` MCP tool. Retry queue purged (2,299 broken entries with no payload data). `syncImplementationOrg` code updated to only write properties that exist (removed `Org Type`, `Color`, `Sort Order`, `Active` which are internal-only fields).

**Verification:** After fix, retry queue processed 4,953 entries successfully. Cron logs show clean syncs with 0 failures.
