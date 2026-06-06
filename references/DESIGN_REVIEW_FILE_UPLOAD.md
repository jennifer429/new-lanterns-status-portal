# Design Review: File Upload Process — Data Loss Risks

**Date:** June 5, 2026  
**Status:** Critical — Multiple data loss and audit gaps identified  
**Severity:** High — Files can disappear silently, audit trails incomplete

---

## Executive Summary

The file upload process has **three critical data loss risks**:

1. **Orphaned Database Records** — File uploaded to S3/Drive, but database insert fails → file exists in storage but no metadata record
2. **Incomplete Audit Trail** — Audit logging is non-blocking; if it fails, no record of upload exists (but file is still in storage)
3. **Race Conditions** — Concurrent uploads can create duplicate records or lose metadata during sync to Notion

**Impact:** Files can disappear from the questionnaire UI while still existing in S3/Google Drive, or vice versa.

---

## Current File Upload Flow

```
Frontend (user selects file)
    ↓
[1] Encode file as base64
    ↓
[2] Send to server: POST /trpc/files.upload
    ↓
[3] Server validates:
    - File size (max 50MB base64 = ~37MB binary)
    - MIME type (whitelist)
    - File name (no path separators)
    - User access (org membership)
    ↓
[4] Decode base64 → Buffer
    ↓
[5] Upload to S3 (storagePut)
    ↓
[6] Get S3 URL (storageGet)
    ↓
[7] Upload to Google Drive (if configured)
    ↓
[8] Record metadata in MySQL (fileAttachments table)
    ↓
[9] Dispatch to Notion (dual-write)
    ↓
[10] Log audit entry to Notion (non-blocking)
    ↓
[11] Return success to frontend
```

---

## Critical Issue #1: Orphaned Database Records

### Scenario

1. File successfully uploads to S3 ✓
2. File successfully uploads to Google Drive ✓
3. Database insert FAILS (connection lost, constraint violation, etc.)
4. Audit log fails (Notion down)
5. Server returns error to frontend
6. **Result:** File exists in S3/Drive but no metadata record in MySQL

### Code Location

**File:** `server/routers/files.ts`, lines 119-128

```typescript
const [result] = await db.insert(fileAttachments).values({
  organizationId: input.organizationId,
  taskId: input.taskId,
  fileName: input.fileName,
  fileUrl: finalUrl,
  fileKey: s3Key,
  fileSize,
  mimeType: input.mimeType,
  uploadedBy: ctx.user.email || "unknown",
});
```

**Problem:** If this insert fails, the file is already in storage. No rollback mechanism.

### Why This Happens

- **No transaction wrapping** — S3 upload and DB insert are separate operations
- **No rollback on failure** — If DB insert fails, S3 file is orphaned
- **No cleanup job** — No process to find and delete orphaned files in S3

### Failure Mode

1. User uploads file
2. S3 upload succeeds
3. DB connection times out
4. User sees error: "Upload failed"
5. User tries again (or gives up)
6. **File exists in S3 but no metadata record**
7. Frontend queries MySQL for files → returns nothing
8. **File is invisible to the questionnaire UI**
9. But it's still taking up storage space and costs money

### The Devil at 2am

You page me: "RMCA's uploaded files disappeared!"

I check:
- ✅ Files in S3? Yes (10 files, 500MB)
- ✅ Files in MySQL? No
- ❓ Why? Database insert failed but S3 upload succeeded

Result: Manual cleanup required. Files are orphaned and must be deleted from S3.

---

## Critical Issue #2: Incomplete Audit Trail

### Scenario

1. File successfully uploads to S3 ✓
2. File successfully uploads to Google Drive ✓
3. Database record created ✓
4. Notion dispatch queued ✓
5. Audit log FAILS (Notion API error, network timeout)
6. Server returns success to frontend (audit failure is non-blocking)
7. **Result:** File uploaded successfully, but no audit record exists

### Code Location

**File:** `server/routers/files.ts`, lines 142-156

```typescript
let auditLogged = true;
try {
  await logFileActivity({
    action: "upload",
    userEmail: ctx.user.email || "unknown",
    // ...
  });
} catch (e) {
  auditLogged = false;  // ← Silent failure, non-blocking
}

return {
  success: true,
  // ...
  status: {
    audit: auditLogged  // ← Client sees audit failed, but what does it do?
  }
};
```

**Problem:** Audit logging is non-blocking. If it fails, the upload succeeds anyway.

### Why This Happens

- **Audit is secondary** — Upload success doesn't depend on audit logging
- **No retry mechanism** — Failed audit logs are enqueued but may never succeed
- **No alerting** — No notification if audit logging fails for an org

### Failure Mode

1. User uploads file
2. File goes to S3, Drive, MySQL ✓
3. Audit log fails (Notion API rate-limited)
4. Frontend shows: `status.audit = false`
5. **User doesn't know what this means** — does it mean the file wasn't uploaded?
6. User might try uploading again
7. **Duplicate file in storage**
8. **No audit trail of who uploaded what**

### Audit Gaps

**What's NOT logged:**
- File downloads (no audit of who accessed files)
- File deletions (no audit of who deleted files)
- File access (no audit of views)
- File size changes (no audit of modifications)
- Failed uploads (no record of attempts)

**What IS logged:**
- Successful uploads only
- Non-blocking, may fail silently

### The Devil at 2am

You page me: "Who uploaded this file? When?"

I check Notion audit log:
- ✅ File exists in MySQL
- ❌ No audit entry (logging failed 3 months ago and was never retried)
- ❓ No way to know who uploaded it or when

Result: No audit trail. Compliance issue.

---

## Critical Issue #3: Race Conditions and Duplicate Records

### Scenario

1. User clicks "Upload" twice rapidly
2. Both requests hit the server simultaneously
3. Both encode file, validate, upload to S3/Drive
4. Both try to insert into MySQL
5. **Result:** Duplicate records in fileAttachments table

### Code Location

**File:** `server/routers/files.ts`, lines 119-128

```typescript
const [result] = await db.insert(fileAttachments).values({
  // No UNIQUE constraint on (organizationId, taskId, fileName)
  // So duplicate inserts are possible
});
```

**Problem:** No UNIQUE constraint prevents duplicate records.

### Why This Happens

- **No idempotency** — Same file can be uploaded multiple times
- **No deduplication** — No check if file already exists
- **No UNIQUE constraint** — Database allows duplicates

### Failure Mode

1. User uploads file
2. Network is slow, user clicks upload again
3. Both requests succeed
4. **Two identical records in fileAttachments**
5. Frontend queries files → returns both (or picks first/last randomly)
6. User sees duplicate file in UI
7. **Confusion about which is the "real" file**
8. **Double storage cost**

### The Devil at 2am

You page me: "RMCA's file list shows duplicates!"

I check MySQL:
- ✅ Two identical fileAttachments records
- ✅ Two identical files in S3
- ❓ Why? No deduplication

Result: Manual cleanup required. Delete duplicate records and S3 files.

---

## Secondary Issues

### Issue 4: No File Size Validation on Disk

**Current:** Validates base64 size (max 50MB base64 = ~37MB binary)

**Missing:** No validation that uploaded file size matches declared size

```typescript
// Current: Only validates base64 length
const fileSize = fileBuffer.length;  // Trust the client

// Better: Validate after decode
if (fileSize !== input.declaredSize) {
  throw new Error("File size mismatch");
}
```

**Risk:** Client could send 50MB base64 that decodes to 100MB, exhausting storage.

### Issue 5: No Cleanup on Sync Failure

**Current:** File uploaded to S3/Drive, metadata in MySQL, but Notion dispatch fails

**Missing:** No mechanism to retry or clean up if Notion sync fails

```typescript
// Current: Fire and forget
dispatch.taskFileAttachment({...});

// Missing: Retry logic, alerting, cleanup
```

**Risk:** File metadata in MySQL but not in Notion. Notion becomes out of sync.

### Issue 6: Google Drive Folder Fallback is Silent

**File:** `server/googleDrive.ts`, lines 132-151

```typescript
try {
  uploadRes = await drive.files.create({...});
} catch (err: any) {
  if (err.message && err.message.includes("File not found")) {
    // Silently fall back to root folder
    uploadRes = await drive.files.create({...});
  }
}
```

**Problem:** If org folder doesn't exist, file silently goes to root folder

**Risk:** Files from different orgs mixed in root folder. Org isolation broken.

### Issue 7: No Virus/Malware Scanning

**Current:** Only validates MIME type and file name

**Missing:** No scanning for malicious content

**Risk:** Malicious files uploaded and shared with other users.

---

## Data Loss Scenarios Summary

| Scenario | Probability | Impact | Recovery |
|----------|-------------|--------|----------|
| S3 upload succeeds, DB insert fails | Medium | File orphaned in S3 | Manual cleanup |
| Audit logging fails | High | No audit trail | Retry queue (may never succeed) |
| Concurrent uploads | Medium | Duplicate records | Manual deduplication |
| Google Drive folder doesn't exist | Low | File in wrong folder | Manual move |
| Notion sync fails | Medium | Metadata out of sync | Retry queue (may never succeed) |
| File size validation bypass | Low | Storage exhaustion | Manual cleanup |

---

## Root Causes (Systemic)

### 1. No Transactional Uploads

**Current:** Upload to storage, then record metadata (two separate operations)

**Better:** Wrap in a transaction or use idempotent keys

```typescript
// Current (broken)
await storagePut(s3Key, fileBuffer);  // Can fail
await db.insert(fileAttachments).values({...});  // Can fail

// Better (transactional)
await db.transaction(async (tx) => {
  await storagePut(s3Key, fileBuffer);
  await tx.insert(fileAttachments).values({...});
});
```

### 2. No Idempotency

**Current:** Same request twice = two uploads

**Better:** Use idempotent keys or deduplication

```typescript
// Current (broken)
const fileKey = makeSafeFileKey(input.fileName);  // Different key each time

// Better (idempotent)
const fileKey = hashFile(input.fileData);  // Same key for same content
```

### 3. Non-Blocking Audit Logging

**Current:** Audit failure doesn't fail the upload

**Better:** Audit is critical; fail the upload if audit fails

```typescript
// Current (broken)
try {
  await logFileActivity({...});
} catch (e) {
  // Silent failure
}

// Better (blocking)
try {
  await logFileActivity({...});
} catch (e) {
  throw new Error("Audit logging failed");  // Fail the upload
}
```

### 4. No Cleanup on Failure

**Current:** If DB insert fails, S3 file is orphaned

**Better:** Rollback storage on DB failure

```typescript
// Current (broken)
await storagePut(s3Key, fileBuffer);
await db.insert(fileAttachments).values({...});  // Can fail

// Better (with rollback)
const s3Key = ...;
try {
  await db.insert(fileAttachments).values({...});
} catch (e) {
  await storageDelete(s3Key);  // Cleanup
  throw e;
}
```

---

## Immediate Fixes (This Week)

### Fix 1: Add UNIQUE Constraint to Prevent Duplicates

**File:** `drizzle/schema.ts`

```typescript
export const fileAttachments = mysqlTable('fileAttachments', {
  // ...
}, (table) => ({
  // Prevent duplicate uploads of same file to same task
  uniqueFilePerTask: uniqueIndex('idx_file_per_task').on(
    table.organizationId,
    table.taskId,
    table.fileName
  ),
}));
```

### Fix 2: Wrap Upload in Transaction with Rollback

**File:** `server/routers/files.ts`

```typescript
const s3Key = makeSafeFileKey(input.fileName);
let uploadedToS3 = false;

try {
  // Upload to S3 first
  const { s3Url } = await uploadFileToDriveAndS3(...);
  uploadedToS3 = true;

  // Then record in DB (within transaction)
  await db.transaction(async (tx) => {
    await tx.insert(fileAttachments).values({...});
    // If this fails, transaction rolls back
  });

  // Then audit (blocking)
  await logFileActivity({...});  // Throw if fails

} catch (e) {
  if (uploadedToS3) {
    // Cleanup S3 on failure
    await storageDelete(s3Key);
  }
  throw e;
}
```

### Fix 3: Make Audit Logging Blocking

**File:** `server/routers/files.ts`

```typescript
// Current (non-blocking)
try {
  await logFileActivity({...});
} catch (e) {
  auditLogged = false;
}

// Better (blocking)
try {
  await logFileActivity({...});
} catch (e) {
  // Don't silently fail — audit is critical
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to audit file upload"
  });
}
```

### Fix 4: Add File Download and Delete Audit Logging

**File:** `server/routers/files.ts`

Add audit logging for:
- File downloads
- File deletions
- File access

### Fix 5: Add Orphaned File Cleanup Job

**File:** `server/cron.ts`

```typescript
// Daily job: find orphaned files in S3 with no DB record
async function cleanupOrphanedFiles() {
  // List all S3 files
  // Find files with no corresponding fileAttachments record
  // Delete orphaned files after 7 days
  // Alert owner of deletions
}
```

---

## Long-Term Fixes (Next Sprint)

### 1. Implement Idempotent Uploads

- Use content hash as file key (same content = same key)
- Prevent duplicate uploads automatically
- Reduce storage costs

### 2. Add Virus/Malware Scanning

- Scan uploaded files before storing
- Reject malicious files
- Alert on suspicious content

### 3. Implement File Versioning

- Track file history (who changed what, when)
- Allow rollback to previous versions
- Improve audit trail

### 4. Add File Encryption at Rest

- Encrypt files in S3
- Encrypt files in Google Drive
- Manage encryption keys securely

### 5. Implement File Access Control

- Track who accessed which files
- Implement download audit logging
- Restrict file access by role

### 6. Add Storage Quota per Organization

- Limit file storage per org
- Alert when approaching quota
- Prevent storage exhaustion

---

## Prevention: Process Changes

### 1. File Upload Checklist

Before uploading files:
- [ ] Validate file size on client (before encoding)
- [ ] Validate MIME type on client
- [ ] Show upload progress
- [ ] Handle network failures gracefully
- [ ] Retry failed uploads

### 2. Database Changes Require Tests

- [ ] Add UNIQUE constraint
- [ ] Add test for duplicate uploads
- [ ] Add test for concurrent uploads
- [ ] Add test for failed DB insert

### 3. Audit Logging is Critical

- [ ] Audit logging must be blocking
- [ ] Audit failures must alert owner
- [ ] Audit logs must be queryable
- [ ] Audit logs must be immutable

### 4. Monitoring and Alerting

- [ ] Monitor S3 file count vs DB record count
- [ ] Alert on orphaned files
- [ ] Alert on audit logging failures
- [ ] Alert on storage quota approaching

---

## Checklist for This Week

- [ ] Add UNIQUE constraint to fileAttachments table
- [ ] Wrap upload in transaction with rollback
- [ ] Make audit logging blocking
- [ ] Add file download audit logging
- [ ] Add file delete audit logging
- [ ] Create orphaned file cleanup job
- [ ] Write tests for concurrent uploads
- [ ] Write tests for failed DB insert
- [ ] Write tests for audit logging failure
- [ ] Document file upload process in data-dictionary.md

---

## References

- **Upload Router:** `server/routers/files.ts`
- **Google Drive Upload:** `server/googleDrive.ts`
- **File Validation:** `server/_core/fileValidation.ts`
- **Audit Logging:** `server/fileAuditLog.ts`
- **Database Schema:** `drizzle/schema.ts` (fileAttachments table)
- **Data Dictionary:** `docs/data-dictionary.md` (§2 File uploads)
