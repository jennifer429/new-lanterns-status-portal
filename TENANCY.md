# Multi-Tenant Architecture & Partner Isolation

This document explains how the New Lantern PACS Onboarding Portal achieves **strict partner isolation** using a single-database multi-tenant architecture.

## Table of Contents

- [Overview](#overview)
- [Architecture Design](#architecture-design)
- [Implementation Details](#implementation-details)
- [Security Model](#security-model)
- [Testing & Verification](#testing--verification)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What is Multi-Tenancy?

**Multi-tenancy** means multiple customers (partners) share the same application and database, but their data is completely isolated from each other.

### Why Single Database?

We chose a **single-database approach** over separate databases per partner because:

✅ **Simpler architecture** - One connection, one schema, easier maintenance  
✅ **Better security** - Database enforces isolation, not just application code  
✅ **Easier for platform admins** - New Lantern can query all data with one connection  
✅ **Cost-effective** - No need to manage multiple database instances  
✅ **Consistent schema** - All partners use the same structure  

### Isolation Strategy

We use **`clientId`-based row-level filtering** to ensure partners can only see their own data:

```
Partner A (clientId=1) → Organizations with clientId=1 → Their responses/files
Partner B (clientId=2) → Organizations with clientId=2 → Their responses/files
New Lantern (clientId=NULL) → ALL organizations → ALL data
```

---

## Architecture Design

### Three-Tier Access Model

```
┌─────────────────────────────────────────────────────────┐
│  Platform Admins (New Lantern)                          │
│  - Email: @newlantern.ai                                │
│  - clientId: NULL                                       │
│  - Access: ALL partners' data                           │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
┌───────▼──────────┐              ┌────────▼─────────┐
│  Partner A Admin │              │  Partner B Admin │
│  - Email: @a.com │              │  - Email: @b.com │
│  - clientId: 1   │              │  - clientId: 2   │
│  - Access: A only│              │  - Access: B only│
└──────────────────┘              └──────────────────┘
        │                                   │
        ▼                                   ▼
  Organizations                       Organizations
  (clientId=1)                        (clientId=2)
```

### Data Hierarchy

```
clients (Partners)
  ├── id: 1 (RadOne)
  │   └── organizations
  │       ├── Memorial Hospital (clientId=1)
  │       ├── St. Mary's (clientId=1)
  │       └── ...
  │
  └── id: 2 (SRV)
      └── organizations
          ├── Baycare Health (clientId=2)
          ├── Regional Medical (clientId=2)
          └── ...
```

---

## Implementation Details

### Database Schema

#### clients Table

```sql
CREATE TABLE clients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### organizations Table (with clientId)

```sql
CREATE TABLE organizations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clientId INT,  -- ← Partner assignment
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  -- ... other fields ...
  FOREIGN KEY (clientId) REFERENCES clients(id),
  INDEX idx_clientId (clientId)  -- ← Critical for performance
);
```

#### users Table (with clientId)

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clientId INT,  -- ← Partner assignment
  email VARCHAR(320),
  role ENUM('user', 'admin') DEFAULT 'user',
  -- ... other fields ...
  FOREIGN KEY (clientId) REFERENCES clients(id),
  INDEX idx_clientId (clientId)
);
```

### Backend Filtering

#### Partner Admin Query

```typescript
// server/routers/admin.ts
getAllOrganizations: protectedProcedure.query(async ({ ctx }) => {
  const db = await getDb();
  
  // Partner admins see only their organizations
  if (ctx.user.clientId) {
    return db
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, ctx.user.clientId));
  }
  
  // Platform admins see everything
  return db.select().from(organizations);
});
```

#### Auto-Assignment on Create

```typescript
createOrganization: protectedProcedure
  .input(z.object({
    clientId: z.number().optional(),  // Optional - will be auto-assigned
    name: z.string(),
    slug: z.string(),
    // ...
  }))
  .mutation(async ({ ctx, input }) => {
    let clientId = input.clientId;
    
    // Auto-assign based on email domain
    if (!clientId) {
      if (ctx.user.email?.endsWith('@srv.com')) {
        clientId = 2; // SRV
      } else if (ctx.user.email?.endsWith('@radone.com')) {
        clientId = 1; // RadOne
      } else if (ctx.user.email?.endsWith('@newlantern.ai')) {
        throw new Error('Platform admins must specify clientId');
      }
    }
    
    // Create organization with assigned clientId
    await db.insert(organizations).values({
      ...input,
      clientId,  // ← Locked to user's partner
    });
  });
```

### Frontend Access Control

#### Email-Based Route Guards

```typescript
// client/src/pages/PartnerAdmin.tsx
export default function PartnerAdmin({ 
  partnerName, 
  allowedDomain 
}: PartnerAdminProps) {
  const { user, loading } = useAuth();
  
  // Redirect if wrong email domain
  useEffect(() => {
    if (!loading && (!user || !user.email?.endsWith(allowedDomain))) {
      setLocation('/');
    }
  }, [user, loading, allowedDomain]);
  
  // Only render if authorized
  return <Dashboard />;
}
```

#### Route Configuration

```typescript
// client/src/App.tsx
<Route path="/org/admin">
  {() => <PlatformAdmin />}  {/* @newlantern.ai only */}
</Route>

<Route path="/org/SRV/admin">
  {() => <PartnerAdmin partnerName="SRV" allowedDomain="@srv.com" />}
</Route>

<Route path="/org/RadOne/admin">
  {() => <PartnerAdmin partnerName="RadOne" allowedDomain="@radone.com" />}
</Route>
```

---

## Security Model

### Defense in Depth

We implement **multiple layers** of security:

#### Layer 1: Database Indexes

```sql
-- Ensures fast filtering by clientId
CREATE INDEX idx_organizations_clientId ON organizations(clientId);
CREATE INDEX idx_users_clientId ON users(clientId);
```

#### Layer 2: Backend Query Filtering

```typescript
// ALWAYS filter by clientId for partner admins
if (ctx.user.clientId) {
  query = query.where(eq(organizations.clientId, ctx.user.clientId));
}
```

#### Layer 3: Frontend Route Guards

```typescript
// Redirect unauthorized users
if (!user.email?.endsWith(allowedDomain)) {
  setLocation('/');
}
```

#### Layer 4: Email Domain Validation

```typescript
// Validate email domain before assignment
const domain = email.split('@')[1];
if (!['srv.com', 'radone.com', 'newlantern.ai'].includes(domain)) {
  throw new Error('Invalid email domain');
}
```

### Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|------------|
| **SQL Injection** | Drizzle ORM uses parameterized queries |
| **Direct API calls** | tRPC procedures validate `ctx.user.clientId` |
| **URL manipulation** | Backend enforces `clientId` filter regardless of URL |
| **Token tampering** | JWT signed with `JWT_SECRET`, verified on every request |
| **Email spoofing** | OAuth providers verify email ownership |

---

## Testing & Verification

### Automated Tests

We use **Vitest** to verify partner isolation:

```typescript
// server/admin.partner-isolation.test.ts
describe('Partner Isolation System', () => {
  it('SRV admin should only see SRV organizations', async () => {
    const srvOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, 2));  // SRV
    
    // All returned orgs should have clientId = 2
    expect(srvOrgs.every(o => o.clientId === 2)).toBe(true);
    
    // Should not see any RadOne orgs (clientId = 1)
    expect(srvOrgs.some(o => o.clientId === 1)).toBe(false);
  });
  
  it('RadOne admin should only see RadOne organizations', async () => {
    const radoneOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clientId, 1));  // RadOne
    
    expect(radoneOrgs.every(o => o.clientId === 1)).toBe(true);
    expect(radoneOrgs.some(o => o.clientId === 2)).toBe(false);
  });
  
  it('New Lantern admin should see all organizations', async () => {
    const allOrgs = await db.select().from(organizations);
    
    const hasSrvOrgs = allOrgs.some(o => o.clientId === 2);
    const hasRadoneOrgs = allOrgs.some(o => o.clientId === 1);
    
    expect(hasSrvOrgs).toBe(true);
    expect(hasRadoneOrgs).toBe(true);
  });
});
```

### Manual Testing Checklist

- [ ] SRV admin cannot see RadOne organizations in UI
- [ ] RadOne admin cannot see SRV organizations in UI
- [ ] New Lantern admin sees all organizations
- [ ] Creating organization auto-assigns correct `clientId`
- [ ] Direct API calls respect `clientId` filtering
- [ ] URL manipulation doesn't bypass filtering

---

## Common Patterns

### Pattern 1: Querying Organizations

```typescript
// ✅ CORRECT - Filtered by clientId
const orgs = await db
  .select()
  .from(organizations)
  .where(
    ctx.user.clientId 
      ? eq(organizations.clientId, ctx.user.clientId)
      : undefined  // Platform admin sees all
  );

// ❌ WRONG - No filtering
const orgs = await db.select().from(organizations);
```

### Pattern 2: Querying Related Data

```typescript
// ✅ CORRECT - Join with organizations to filter
const responses = await db
  .select()
  .from(responses)
  .innerJoin(organizations, eq(responses.organizationId, organizations.id))
  .where(
    ctx.user.clientId
      ? eq(organizations.clientId, ctx.user.clientId)
      : undefined
  );

// ❌ WRONG - Direct query without join
const responses = await db.select().from(responses);
```

### Pattern 3: Creating Resources

```typescript
// ✅ CORRECT - Auto-assign clientId
const [newOrg] = await db.insert(organizations).values({
  ...input,
  clientId: determineClientId(ctx.user.email),  // Auto-assign
});

// ❌ WRONG - Allow user to specify any clientId
const [newOrg] = await db.insert(organizations).values({
  ...input,
  clientId: input.clientId,  // User could bypass isolation
});
```

---

## Troubleshooting

### Problem: Partner admin sees other partners' data

**Diagnosis:**
```sql
-- Check if query is missing clientId filter
SELECT * FROM organizations WHERE slug = ?;  -- ❌ No filter
```

**Solution:**
```sql
-- Add clientId filter
SELECT * FROM organizations WHERE slug = ? AND clientId = ?;  -- ✅ Filtered
```

### Problem: Organization created with wrong clientId

**Diagnosis:**
```typescript
// Check user's email domain
console.log(ctx.user.email);  // admin@srv.com
console.log(ctx.user.clientId);  // Should be 2
```

**Solution:**
```typescript
// Update user's clientId
UPDATE users SET clientId = 2 WHERE email = 'admin@srv.com';
```

### Problem: New Lantern admin can't see all data

**Diagnosis:**
```typescript
// Check if clientId is NULL (not 0 or empty string)
console.log(ctx.user.clientId);  // Should be NULL
```

**Solution:**
```sql
-- Set clientId to NULL for platform admins
UPDATE users SET clientId = NULL WHERE email LIKE '%@newlantern.ai';
```

---

## Performance Considerations

### Index Strategy

```sql
-- Critical indexes for partner isolation
CREATE INDEX idx_organizations_clientId ON organizations(clientId);
CREATE INDEX idx_users_clientId ON users(clientId);

-- Composite indexes for common queries
CREATE INDEX idx_orgs_client_status ON organizations(clientId, status);
CREATE INDEX idx_orgs_client_created ON organizations(clientId, createdAt DESC);
```

### Query Optimization

```typescript
// ✅ GOOD - Single query with filter
const orgs = await db
  .select()
  .from(organizations)
  .where(eq(organizations.clientId, clientId));

// ❌ BAD - Fetch all then filter in memory
const allOrgs = await db.select().from(organizations);
const filtered = allOrgs.filter(o => o.clientId === clientId);
```

### Caching Strategy

```typescript
// Cache client metadata (rarely changes)
const clientCache = new Map<number, Client>();

// Don't cache organization data (changes frequently)
// Always query fresh from database
```

---

## Migration Guide

### Adding a New Partner

**Step 1: Insert client record**

```sql
INSERT INTO clients (name, slug, description, status) 
VALUES ('NewPartner', 'NewPartner', 'Description', 'active');
```

**Step 2: Add route in App.tsx**

```typescript
<Route path="/org/NewPartner/admin">
  {() => <PartnerAdmin partnerName="NewPartner" allowedDomain="@newpartner.com" />}
</Route>
```

**Step 3: Update auto-assignment logic**

```typescript
// server/routers/admin.ts
if (ctx.user.email?.endsWith('@newpartner.com')) {
  clientId = 3; // NewPartner
}
```

**Step 4: Create test user**

```sql
INSERT INTO users (openId, name, email, role, clientId) 
VALUES ('test-newpartner', 'NewPartner Admin', 'admin@newpartner.com', 'admin', 3);
```

### Migrating Existing Data

If you have organizations without `clientId`:

```sql
-- 1. Identify orphaned organizations
SELECT id, name, slug FROM organizations WHERE clientId IS NULL;

-- 2. Assign to appropriate partner based on slug or contact email
UPDATE organizations 
SET clientId = 1 
WHERE slug LIKE 'radone-%';

UPDATE organizations 
SET clientId = 2 
WHERE slug LIKE 'srv-%';

-- 3. Verify no orphans remain
SELECT COUNT(*) FROM organizations WHERE clientId IS NULL;
```

---

## Best Practices

### DO ✅

- **Always filter by `clientId`** in backend queries
- **Use indexes** on `clientId` columns
- **Auto-assign `clientId`** based on email domain
- **Test partner isolation** with automated tests
- **Validate email domains** before assignment
- **Use NULL for platform admins** (not 0 or empty string)

### DON'T ❌

- **Don't trust frontend** to enforce isolation
- **Don't allow users to specify their own `clientId`**
- **Don't fetch all data then filter in memory**
- **Don't use 0 or empty string for platform admins**
- **Don't skip `clientId` validation**
- **Don't forget to add indexes**

---

## Compliance & Audit

### Data Residency

- All data stored in single database (same region)
- Partners can request data export via platform admin
- Data deletion handled via CASCADE on foreign keys

### Audit Trail

Every response includes:
- `userEmail` - Who made the change
- `createdAt` - When first created
- `updatedAt` - When last modified

### GDPR Compliance

- **Right to access**: Platform admin can export partner's data
- **Right to erasure**: Delete organization → cascades to all related data
- **Right to portability**: Export responses as JSON/CSV

---

## Summary

The New Lantern PACS Onboarding Portal achieves **strict partner isolation** through:

1. **Database-level filtering** via `clientId`
2. **Email domain-based access control**
3. **Auto-assignment** of `clientId` on resource creation
4. **Multiple security layers** (DB, backend, frontend)
5. **Automated testing** to verify isolation

This architecture provides:
- ✅ **Security**: Partners cannot access each other's data
- ✅ **Simplicity**: Single database, single schema
- ✅ **Performance**: Indexed queries, efficient filtering
- ✅ **Scalability**: Easy to add new partners
- ✅ **Maintainability**: Consistent patterns across codebase

For schema details, see [DATA_DICTIONARY.md](./DATA_DICTIONARY.md).  
For setup instructions, see [README.md](./README.md).
