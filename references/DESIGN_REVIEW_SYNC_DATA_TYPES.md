# Design Review: Sync, Data Dictionary, and Type Checking Issues

**Date:** June 5, 2026  
**Status:** Critical — Multiple systemic failures identified  
**Severity:** High — Data loss, silent failures, type confusion

---

## Executive Summary

The system has **three interconnected design failures** that have caused data to silently disappear from the questionnaire:

1. **Sync Brittleness** — Hardcoded column names in Notion sync; new fields added to Notion are silently ignored
2. **Data Dictionary Drift** — No single source of truth for column definitions; Notion schema changes without coordinating with code
3. **Type Checking Gaps** — Mixed data types (string vs Date, JSON vs object) cause runtime errors that are caught too late

**Impact:** RMCA's workflow descriptions (orders_description, reports_description, priors_description) exist in Notion but never reach the questionnaire because the sync code doesn't know about them.

---

## Problem 1: Sync Brittleness

### Current Design (Broken)

```typescript
// server/notionSyncBack.ts, lines 170-174
const slug = props?.["Slug"]?.rich_text?.[0]?.plain_text || "";
const questionId = props?.["Question ID"]?.rich_text?.[0]?.plain_text || "";
const answer = props?.["Answer"]?.rich_text?.[0]?.plain_text || "";
```

**Issue:** The sync is hardcoded to extract only three columns: `Slug`, `Question ID`, `Answer`. If Claude adds new columns to Notion (like `Orders Description`), they are silently ignored.

### Why This Happened

- When building the sync, I assumed the Notion schema would be static
- I optimized for the "happy path" (known columns) without building flexibility
- No validation or warning system for unmapped columns

### Failure Mode

1. Claude adds `Orders Description` column to Notion
2. Sync queries Notion and sees the new column
3. Sync code doesn't know what to do with it
4. **Silent failure:** No error, no warning, no alert
5. Data exists in Notion but never reaches MySQL
6. Frontend queries MySQL, gets nothing, shows empty questionnaire

### The Devil at 2am

You page me at 2am: "RMCA's workflow data disappeared!"

I check:
- ✅ Data in Notion? Yes
- ✅ Sync running? Yes
- ✅ MySQL updated? No
- ❓ Why? No errors in logs, no warnings, no alerts

Result: 30 minutes of debugging to discover the sync code doesn't know about the new columns.

### Root Cause

**Assumption:** "The Notion schema is fixed and known at code-write time."

**Reality:** "The Notion schema evolves as requirements change, and the sync code must adapt."

---

## Problem 2: Data Dictionary Drift

### Current State

There is **no centralized data dictionary**. Column definitions exist in multiple places:

1. **Notion** — The actual schema (source of truth for Claude's edits)
2. **Drizzle schema.ts** — MySQL schema (intakeResponses table)
3. **Sync code** — Hardcoded column mappings (notionSyncBack.ts)
4. **Frontend** — Questionnaire questions (questionnaireData.ts)
5. **Type definitions** — TypeScript interfaces (shared/types.ts)

### Example: `completedAt` Field

**In Notion:** `completedAt` might be stored as a string (ISO 8601)  
**In MySQL:** `completedAt` is a DATETIME column  
**In sync code:** Assumed to be a Date object  
**In frontend:** Sometimes string, sometimes Date  
**Result:** `TypeError: payload.completedAt.toISOString is not a function`

### Why This Happened

- Each layer (Notion, MySQL, code) evolved independently
- No single document that says "here's what each field is and how it flows"
- Type conversions happen at multiple points with no validation

### Failure Mode

1. Notion stores `completedAt` as a string
2. Sync pulls it as a string, stores in MySQL as string
3. Retry queue has stale payloads with string `completedAt`
4. Code tries to call `.toISOString()` on a string
5. **Runtime error:** Task sync fails for all tasks with `completedAt`

### The Devil at 2am

You page me: "All task syncs are failing!"

I check:
- ✅ Notion updated? Yes
- ✅ Sync running? Yes
- ✅ MySQL updated? Yes
- ❓ Why are syncs failing? `TypeError: payload.completedAt.toISOString is not a function`

Result: Add type checking to handle both string and Date. But this is a band-aid, not a fix.

---

## Problem 3: Type Checking Gaps

### Current Issues

#### Issue 3a: Mixed Data Types

**responses table:**
```sql
SELECT response FROM responses WHERE questionId = 'A.contacts';
-- Result: JSON string: '{"it": {...}, "admin": {...}}'
```

**intakeResponses table:**
```sql
SELECT response FROM intakeResponses WHERE questionId = 'A.contacts';
-- Result: JSON string: '{"it": {...}, "admin": {...}}'
```

**Frontend state:**
```typescript
const value = responses[question.id];
// Could be: string, object, array, boolean, null, undefined
```

**Sync payload:**
```typescript
const payload = { completedAt: "2026-06-05T10:00:00Z" };
// Is this a string or a Date?
```

#### Issue 3b: No Runtime Validation

When data flows from Notion → MySQL → Frontend, there's no validation that it matches the expected type.

```typescript
// Before: Assumed Date
payload.completedAt.toISOString(); // ❌ Fails if string

// After: Type check
typeof payload.completedAt === 'string' 
  ? payload.completedAt 
  : payload.completedAt.toISOString(); // ✅ Works but ugly
```

#### Issue 3c: Silent Type Coercion

```typescript
// JSON.parse might return string, object, array, or null
const value = JSON.parse(response);
// No validation that value is what we expect
```

---

## Root Causes (Systemic)

### 1. No Source of Truth for Data Schema

**Current:** Each layer defines its own schema
- Notion: Column definitions (manual)
- MySQL: Drizzle schema (code)
- Frontend: Question definitions (code)
- Sync: Hardcoded mappings (code)

**Result:** When one changes, others drift out of sync.

### 2. No Validation Layer

Data flows: Notion → MySQL → Frontend with no validation at each step.

**Current:** Trust and hope
```typescript
const answer = props?.["Answer"]?.rich_text?.[0]?.plain_text || "";
// Hope that "Answer" column exists and has the right format
```

**Better:** Validate at each boundary
```typescript
const answer = validateAnswerColumn(props);
// Throws if column missing or format wrong
```

### 3. Sync Code Assumes Static Schema

**Current:** Hardcoded column names
```typescript
const slug = props?.["Slug"]?.rich_text?.[0]?.plain_text || "";
const questionId = props?.["Question ID"]?.rich_text?.[0]?.plain_text || "";
```

**Better:** Auto-discover and map
```typescript
const columnMap = await discoverNotionColumns(dataSourceId);
const slug = extractColumn(props, columnMap.slug);
const questionId = extractColumn(props, columnMap.questionId);
```

### 4. No Alerting on Sync Failures

**Current:** Silent failures
- New columns in Notion? Ignored.
- Type mismatches? Caught at runtime.
- Sync errors? Logged but not alerted.

**Better:** Active monitoring
- Alert when unmapped columns appear
- Alert on type mismatches
- Alert on sync failures after N retries

---

## Immediate Fixes (This Week)

### Fix 1: Update Sync to Handle New Workflow Fields

**File:** `server/notionSyncBack.ts`

Add mapping for new columns:
```typescript
const fieldMappings = {
  "Slug": "slug",
  "Question ID": "questionId",
  "Answer": "answer",
  "Orders Description": "IW.orders_description",
  "Reports Description": "IW.reports_description",
  "Priors Description": "IW.priors_description",
};
```

Extract all mapped columns:
```typescript
const extracted = {};
for (const [notionCol, questionId] of Object.entries(fieldMappings)) {
  if (questionId !== "slug" && questionId !== "questionId") {
    extracted[questionId] = props?.[notionCol]?.rich_text?.[0]?.plain_text || "";
  }
}
```

### Fix 2: Add Type Checking at Sync Boundaries

**File:** `server/notionSyncBack.ts`

Validate before upsert:
```typescript
function validateAnswer(questionId: string, answer: any): string {
  if (typeof answer !== "string") {
    throw new Error(`Expected string for ${questionId}, got ${typeof answer}`);
  }
  return answer;
}
```

### Fix 3: Add Alerting for Unmapped Columns

**File:** `server/notionSyncBack.ts`

Log warnings for new columns:
```typescript
const seenColumns = new Set(Object.keys(fieldMappings));
for (const col of Object.keys(props)) {
  if (!seenColumns.has(col)) {
    console.warn(`[notion-sync] Unmapped column in Notion: ${col}`);
    // Alert owner after N occurrences
  }
}
```

---

## Long-Term Fixes (Next Sprint)

### 1. Create Centralized Data Dictionary

**File:** `references/DATA_DICTIONARY.md`

```markdown
# Data Dictionary

## Field: Orders Description
- **Notion Column:** "Orders Description"
- **Question ID:** IW.orders_description
- **MySQL Column:** intakeResponses.response
- **Type:** string (plain text, max 2000 chars)
- **Source of Truth:** Notion (synced → MySQL)
- **Sync Frequency:** Every 5 minutes
- **Frontend Display:** Questionnaire, Workflows section
```

### 2. Build Schema Validation Framework

```typescript
// Define once, use everywhere
const FieldSchema = {
  "IW.orders_description": {
    type: "string",
    maxLength: 2000,
    source: "notion",
    notionColumn: "Orders Description",
  },
  "completedAt": {
    type: "date",
    source: "portal|notion",
    validation: (v) => v instanceof Date || typeof v === "string",
  },
};

// Use in sync
validateField("IW.orders_description", answer, FieldSchema);

// Use in frontend
const value = validateField("completedAt", payload.completedAt, FieldSchema);
```

### 3. Make Sync Auto-Discoverable

```typescript
// Instead of hardcoded mappings, query Notion schema
async function discoverNotionSchema(dataSourceId: string) {
  const schema = await client.dataSources.getSchema(dataSourceId);
  return schema.properties.map(p => ({
    notionName: p.name,
    type: p.type,
    // Try to infer questionId from name
    questionId: inferQuestionId(p.name),
  }));
}
```

### 4. Add Comprehensive Monitoring

```typescript
// Track sync health
interface SyncMetrics {
  rowsFetched: number;
  rowsProcessed: number;
  rowsFailed: number;
  unmappedColumns: Set<string>;
  typeErrors: Array<{ field: string; error: string }>;
  duration: number;
}

// Alert on degradation
if (metrics.typeErrors.length > 0) {
  await notifyOwner({
    title: "Sync Type Errors",
    content: `${metrics.typeErrors.length} type mismatches in sync`,
  });
}
```

---

## Prevention: Process Changes

### 1. Data Dictionary Review Before Notion Changes

**When:** Before Claude edits Notion schema  
**Who:** Claude + Code Review  
**What:** 
- Document the new column in DATA_DICTIONARY.md
- Identify the corresponding questionId
- Specify the data type and validation rules
- Plan the sync code changes

### 2. Sync Code Changes Must Include Tests

**When:** Adding support for new Notion columns  
**Who:** Code author  
**What:**
- Add test data to Notion
- Verify sync pulls it correctly
- Verify type validation works
- Verify frontend displays it

### 3. Type Definitions Are Contracts

**When:** Defining a new field type  
**Who:** Shared across frontend/backend  
**What:**
- Define in `shared/types.ts` with JSDoc
- Add runtime validation
- Add test cases for edge cases (null, empty, wrong type)

### 4. Sync Failures Must Alert

**When:** Sync encounters unmapped columns or type errors  
**Who:** Automated  
**What:**
- Log with context (which column, which org, which row)
- Alert owner after N failures
- Provide actionable next steps

---

## Checklist for This Week

- [ ] Update notionSyncBack.ts to handle new workflow description fields
- [ ] Add type checking for completedAt (string vs Date)
- [ ] Add alerting for unmapped Notion columns
- [ ] Create DATA_DICTIONARY.md with all current fields
- [ ] Write tests for sync with mixed data types
- [ ] Document the Notion Update Playbook (when/how to change schema safely)
- [ ] Run full sync test with RMCA data
- [ ] Verify workflow descriptions appear in questionnaire

---

## References

- **Sync Code:** `server/notionSyncBack.ts`
- **Type Issues:** `server/notionTaskValidation.ts:142` (completedAt.toISOString)
- **Data Flow:** Notion → MySQL (intakeResponses) → Frontend (useIntakeData)
- **Related Issues:** 
  - Sync brittleness (hardcoded columns)
  - Data dictionary drift (multiple sources of truth)
  - Type confusion (string vs Date, JSON vs object)
