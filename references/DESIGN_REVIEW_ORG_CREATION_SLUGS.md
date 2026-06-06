# Design Review: Organization Creation and Slug Handling

**Date:** June 5, 2026  
**Status:** Critical — Multiple data integrity and collision risks identified  
**Severity:** High — Slug collisions can break URL routing and data access

---

## Executive Summary

The organization creation and slug system has **four critical design flaws**:

1. **No Slug Validation** — Slugs can contain invalid characters, spaces, uppercase letters that cause routing/matching failures
2. **Slug Collision Risk** — Multiple orgs can have the same slug when normalized (case-insensitive, spaces-as-dashes)
3. **Ambiguous Org Resolution** — `resolveOrgByIdentifier` falls back to name matching, which can be ambiguous
4. **Silent Slug Duplication** — No constraint prevents duplicate slugs in different forms (e.g., "RMCA" vs "rmca" vs "R MCA")

**Impact:** Users can't reliably access their organizations via URL. Data can be routed to the wrong org. Slug collisions create silent data loss.

---

## Current Organization Creation Flow

```
Admin creates org via API: POST /trpc/admin.createOrganization
    ↓
Input validation:
  - name: string (required)
  - slug: string (required)
  - clientId: number (optional for partner admins)
  - contactName, contactEmail, contactPhone (optional)
  - status: enum (active|completed|paused, default active)
    ↓
Check slug uniqueness:
  SELECT * FROM organizations WHERE slug = input.slug
    ↓
If slug exists → throw CONFLICT error
    ↓
Insert into organizations table
    ↓
Dispatch to Notion (dual-write)
    ↓
Return success + organizationId
```

---

## Current Slug Resolution Flow

```
Frontend requests data with organizationSlug parameter
    ↓
resolveOrgByIdentifier(db, identifier)
    ↓
Query: WHERE slug = identifier OR LOWER(slug) = LOWER(identifier) OR LOWER(name) = LOWER(identifier)
    ↓
If 0 matches → return undefined
If 1 match → return org
If 2+ matches:
  - Prefer exact slug match
  - Then prefer case-insensitive slug match
  - Otherwise return undefined (ambiguous)
    ↓
If org found → use org.id for all subsequent queries
If org not found → error
```

---

## Critical Issue #1: No Slug Validation

### Scenario

1. Admin creates org with slug: `"RMCA Hospital"`
2. Slug is stored as-is (with space and uppercase)
3. Frontend tries to access: `/org/RMCA%20Hospital/intake`
4. **Router can't match the slug** (URL encoding issues, case sensitivity)
5. **Data access fails silently**

### Code Location

**File:** `server/routers/admin.ts`, lines 639-649

```typescript
.input(
  z.object({
    clientId: z.number().optional(),
    name: z.string(),
    slug: z.string(),  // ← No validation!
    // ...
  })
)
```

**Problem:** Slug accepts any string. No format validation.

### Why This Happens

- **No slug validation** — Zod schema doesn't enforce slug format
- **No normalization** — Slug stored as-is, not normalized
- **No documentation** — Admins don't know what makes a valid slug

### Failure Mode

1. Admin creates org with slug: `"New Lantern PACS"`
2. Slug stored as: `"New Lantern PACS"`
3. Frontend tries to access: `/org/New%20Lantern%20PACS/intake`
4. **URL routing breaks** (spaces cause issues)
5. **Data access fails**

### Valid Slug Format

**Should be:**
- Lowercase only
- Alphanumeric + hyphens only
- No spaces, underscores, or special characters
- Max 100 characters
- URL-safe

**Example valid slugs:**
- `rmca-hospital`
- `memorial-general`
- `childrens-hospital-boston`

**Example invalid slugs:**
- `RMCA Hospital` (spaces, uppercase)
- `rmca_hospital` (underscores)
- `rmca-hospital!` (special characters)
- `R MCA` (spaces)

---

## Critical Issue #2: Slug Collision Risk

### Scenario

1. Admin creates org with slug: `"RMCA"`
2. Later, admin creates org with slug: `"rmca"` (lowercase)
3. **Both slugs exist in database** (UNIQUE constraint is case-sensitive)
4. `resolveOrgByIdentifier("rmca")` returns **ambiguous** (2 matches)
5. **Data access fails**

### Code Location

**File:** `drizzle/schema.ts`, line 62

```typescript
slug: varchar("slug", { length: 100 }).notNull().unique(),
```

**Problem:** UNIQUE constraint is case-sensitive. `"RMCA"` and `"rmca"` are different.

### Why This Happens

- **MySQL UNIQUE is case-sensitive by default** (depends on collation)
- **No normalization before insert** — Slug stored as-is
- **Slug resolution tries case-insensitive matching** — Creates ambiguity

### Failure Mode

1. Admin creates: `slug = "RMCA"`
2. Admin creates: `slug = "rmca"`
3. Both exist in database (UNIQUE allows both)
4. Frontend requests: `/org/rmca/intake`
5. `resolveOrgByIdentifier("rmca")` finds 2 matches:
   - Exact match: `"rmca"` ✓
   - Case-insensitive match: `"RMCA"` ✓
6. **Ambiguous — which org to use?**
7. Code returns undefined (refuses to guess)
8. **Data access fails**

### The Devil at 2am

You page me: "RMCA's data disappeared!"

I check:
- ✅ Org exists in MySQL
- ✅ Data exists in MySQL
- ❌ `resolveOrgByIdentifier("rmca")` returns undefined
- ❓ Why? Two orgs have similar slugs

Result: Manual cleanup required. Delete duplicate org.

---

## Critical Issue #3: Ambiguous Org Resolution

### Scenario

1. Two orgs exist:
   - Org A: `name = "Memorial General Hospital"`, `slug = "memorial-general"`
   - Org B: `name = "Memorial General"`, `slug = "memorial"`
2. Frontend requests: `/org/Memorial%20General/intake`
3. `resolveOrgByIdentifier("Memorial General")` finds 2 matches:
   - Case-insensitive name match: Org A ✓
   - Case-insensitive name match: Org B ✓
4. **Ambiguous — which org?**
5. Code returns undefined
6. **Data access fails**

### Code Location

**File:** `server/_core/orgLookup.ts`, lines 18-49

```typescript
export async function resolveOrgByIdentifier(db: Db, identifier: string) {
  const matches = await db
    .select()
    .from(organizations)
    .where(
      or(
        eq(organizations.slug, identifier),
        sql`LOWER(${organizations.slug}) = LOWER(${identifier})`,
        sql`LOWER(${organizations.name}) = LOWER(${identifier})`,  // ← Name fallback
      ),
    )
    .limit(2);

  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  // Multiple rows matched. Prefer slug match...
  const exact = matches.find((o) => o.slug === identifier);
  if (exact) return exact;

  const slugMatch = matches.find(
    (o) => o.slug.toLowerCase() === identifier.toLowerCase(),
  );
  if (slugMatch) return slugMatch;

  // Ambiguous name match — refuse to guess.
  return undefined;  // ← Silent failure
}
```

**Problem:** Falls back to name matching, which can be ambiguous.

### Why This Happens

- **Name fallback is too broad** — Multiple orgs can have similar names
- **No uniqueness constraint on name** — Names can be duplicated
- **Silent failure** — Returns undefined without alerting

### Failure Mode

1. Admin creates two orgs with similar names
2. Frontend tries to access by name
3. `resolveOrgByIdentifier` finds 2 matches
4. Returns undefined
5. **Data access fails silently**
6. User sees blank page or error

### The Devil at 2am

You page me: "User can't access their org!"

I check:
- ✅ Org exists
- ✅ User has access
- ❌ `resolveOrgByIdentifier` returns undefined
- ❓ Why? Ambiguous name match

Result: Manual debugging required. Rename org or delete duplicate.

---

## Critical Issue #4: Silent Slug Duplication

### Scenario

1. Admin creates org with slug: `"R MCA"` (with space)
2. System stores as-is: `"R MCA"`
3. Later, admin creates org with slug: `"RMCA"`
4. System stores as-is: `"RMCA"`
5. **Both exist in database** (different strings)
6. But when normalized:
   - `"R MCA"` → `"rmca"` (after lowercase + space-to-dash)
   - `"RMCA"` → `"rmca"` (after lowercase)
7. **Collision in normalized form**
8. **Data routing breaks**

### Code Location

**File:** `server/routers/connectivity.ts`, line 43-44

```typescript
function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
```

**Problem:** Connectivity router normalizes slugs, but creation doesn't. Creates collision.

### Why This Happens

- **No normalization at creation time** — Slug stored as-is
- **Normalization happens at query time** — Different parts of code normalize differently
- **No UNIQUE constraint on normalized slug** — Database allows duplicates

### Failure Mode

1. Admin creates: `slug = "R MCA"`
2. Admin creates: `slug = "RMCA"`
3. Connectivity router normalizes both to: `"rmca"`
4. **Collision** — which org does the data belong to?
5. **Data routed to wrong org**
6. **Silent data loss**

### The Devil at 2am

You page me: "RMCA's connectivity data is wrong!"

I check:
- ✅ Data exists in Notion
- ✅ Data exists in MySQL
- ❌ Data is associated with wrong org
- ❓ Why? Slug normalization collision

Result: Manual data cleanup required. Reassign data to correct org.

---

## Secondary Issues

### Issue 5: No Slug Immutability Enforcement

**Current:** Comment says slug is immutable, but code allows updates

```typescript
// File: server/routers/admin.ts, lines 701-702
// Slug is intentionally not editable — it's the stable URL identifier

// But updateOrganization doesn't prevent slug updates!
```

**Risk:** Admin could change slug, breaking all bookmarks and data access.

### Issue 6: No Slug Format Documentation

**Current:** No documentation of what makes a valid slug

**Risk:** Admins create invalid slugs, causing routing failures.

### Issue 7: Case-Sensitive UNIQUE Constraint

**Current:** MySQL UNIQUE constraint is case-sensitive

**Risk:** `"RMCA"` and `"rmca"` are treated as different slugs.

### Issue 8: No Audit Trail for Org Creation

**Current:** Org creation is not logged

**Risk:** No record of who created org, when, or what data was entered.

---

## Root Causes (Systemic)

### 1. No Slug Normalization at Creation

**Current:** Slug accepted as-is, no normalization

**Better:** Normalize slug before storing

```typescript
// Current (broken)
const slug = input.slug;  // "RMCA Hospital"

// Better (normalized)
const slug = input.slug
  .toLowerCase()
  .trim()
  .replace(/\s+/g, "-")
  .replace(/[^a-z0-9-]/g, "");  // "rmca-hospital"
```

### 2. No Unique Constraint on Normalized Slug

**Current:** UNIQUE constraint on raw slug (case-sensitive)

**Better:** Normalize before storing, use case-insensitive UNIQUE

```typescript
// Current (broken)
slug: varchar("slug", { length: 100 }).notNull().unique(),

// Better (normalized + case-insensitive)
slug: varchar("slug", { length: 100 }).notNull().unique(),
// With MySQL collation: utf8mb4_unicode_ci (case-insensitive)
```

### 3. Name Fallback is Too Broad

**Current:** `resolveOrgByIdentifier` falls back to name matching

**Better:** Only use slug, never fall back to name

```typescript
// Current (broken)
where(
  or(
    eq(organizations.slug, identifier),
    sql`LOWER(${organizations.slug}) = LOWER(${identifier})`,
    sql`LOWER(${organizations.name}) = LOWER(${identifier})`,  // ← Too broad
  ),
)

// Better (slug only)
where(
  or(
    eq(organizations.slug, identifier),
    sql`LOWER(${organizations.slug}) = LOWER(${identifier})`,
  ),
)
```

### 4. No Slug Validation at Creation

**Current:** Zod schema doesn't validate slug format

**Better:** Validate slug format before storing

```typescript
// Current (broken)
slug: z.string(),

// Better (validated)
slug: z
  .string()
  .min(3)
  .max(100)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens only")
  .transform(s => s.toLowerCase().trim().replace(/\s+/g, "-"))
```

---

## Immediate Fixes (This Week)

### Fix 1: Add Slug Validation to Creation

**File:** `server/routers/admin.ts`

```typescript
.input(
  z.object({
    // ...
    slug: z
      .string()
      .min(3, "Slug must be at least 3 characters")
      .max(100, "Slug must be at most 100 characters")
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens only")
      .transform(s => s.toLowerCase().trim().replace(/\s+/g, "-")),
    // ...
  })
)
```

### Fix 2: Remove Name Fallback from Org Resolution

**File:** `server/_core/orgLookup.ts`

```typescript
export async function resolveOrgByIdentifier(db: Db, identifier: string) {
  if (!identifier) return undefined;

  const matches = await db
    .select()
    .from(organizations)
    .where(
      or(
        eq(organizations.slug, identifier),
        sql`LOWER(${organizations.slug}) = LOWER(${identifier})`,
        // ← Remove name fallback
      ),
    )
    .limit(2);

  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  // Prefer exact slug match
  const exact = matches.find((o) => o.slug === identifier);
  if (exact) return exact;

  // Otherwise return first match (should only be 1 after removing name fallback)
  return matches[0];
}
```

### Fix 3: Prevent Slug Updates

**File:** `server/routers/admin.ts`

```typescript
updateOrganization: adminDbProcedure
  .input(
    z.object({
      id: z.number(),
      name: z.string().optional(),
      // ... other fields ...
      // ← Remove slug from updatable fields
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { db } = ctx;
    const { id, ...updates } = input;

    // Explicitly prevent slug updates
    if ('slug' in updates) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Organization slug cannot be changed"
      });
    }

    await db.update(organizations).set(updates).where(eq(organizations.id, id));
    return { success: true };
  }),
```

### Fix 4: Add Slug Audit Logging

**File:** `server/routers/admin.ts`

```typescript
createOrganization: adminDbProcedure
  .mutation(async ({ ctx, input }) => {
    // ... create org ...

    // Audit log
    await logOrgActivity({
      action: "create",
      organizationName: input.name,
      organizationSlug: input.slug,
      userEmail: ctx.user.email,
      userRole: ctx.user.role,
      notes: `Created by ${ctx.user.email}`,
    });

    return { success: true, organizationId: newOrg.insertId };
  }),
```

### Fix 5: Deduplicate Existing Slugs

**File:** `scripts/dedupe-slugs.mjs`

```javascript
// Find orgs with duplicate normalized slugs
// Keep the one with earliest createdAt
// Delete or rename duplicates
// Alert owner of changes
```

---

## Long-Term Fixes (Next Sprint)

### 1. Add Slug History Table

- Track slug changes (even though we prevent them now)
- Maintain URL redirects for old slugs
- Improve audit trail

### 2. Implement Slug Aliases

- Allow orgs to have multiple slugs
- Useful for rebranding without breaking URLs

### 3. Add Slug Suggestions

- When admin enters org name, suggest slug
- Prevent typos and invalid formats

### 4. Implement Slug Validation Tests

- Test all edge cases (spaces, uppercase, special chars)
- Test collision detection
- Test ambiguous resolution

### 5. Add Slug Monitoring

- Alert on duplicate slugs
- Alert on invalid slug formats
- Monitor slug resolution failures

---

## Prevention: Process Changes

### 1. Slug Creation Checklist

Before creating org:
- [ ] Slug is lowercase only
- [ ] Slug contains only alphanumeric + hyphens
- [ ] Slug is URL-safe
- [ ] Slug doesn't collide with existing orgs
- [ ] Slug is descriptive (e.g., `rmca-hospital` not `org123`)

### 2. Slug Naming Convention

- Use org abbreviation + location or type
- Examples:
  - `rmca-hospital` (Rocky Mountain Care Alliance)
  - `memorial-general-boston` (Memorial General Hospital, Boston)
  - `childrens-hospital-la` (Children's Hospital Los Angeles)

### 3. Database Changes Require Tests

- [ ] Add test for slug validation
- [ ] Add test for slug collision detection
- [ ] Add test for org resolution
- [ ] Add test for ambiguous resolution

### 4. Monitoring and Alerting

- [ ] Monitor for duplicate slugs
- [ ] Monitor for invalid slug formats
- [ ] Monitor for org resolution failures
- [ ] Alert owner on issues

---

## Checklist for This Week

- [ ] Add slug validation to createOrganization
- [ ] Remove name fallback from resolveOrgByIdentifier
- [ ] Prevent slug updates in updateOrganization
- [ ] Add slug audit logging
- [ ] Run dedupe script to fix existing duplicates
- [ ] Write tests for slug validation
- [ ] Write tests for slug collision detection
- [ ] Write tests for org resolution
- [ ] Document slug naming convention
- [ ] Update data-dictionary.md with slug rules

---

## References

- **Org Creation:** `server/routers/admin.ts` (line 638)
- **Org Resolution:** `server/_core/orgLookup.ts`
- **Org Schema:** `drizzle/schema.ts` (organizations table)
- **Slug Normalization:** `server/routers/connectivity.ts` (line 43)
- **Data Dictionary:** `docs/data-dictionary.md`
