import { or, eq, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/mysql2";
import { organizations } from "../../drizzle/schema";

type Db = ReturnType<typeof drizzle>;

/**
 * Resolve an org by URL identifier.
 *
 * The URL slug is the canonical identifier, but admins occasionally rename an
 * org's `name` without updating its `slug` — leaving any URL bookmarked under
 * the new name pointing at no row, which silently breaks every save on the
 * page. To prevent that class of bug, we try `slug` first (exact, then
 * case-insensitive) and then fall back to a unique case-insensitive match on
 * `name`. If the fallback is ambiguous (multiple orgs share a name) we return
 * undefined rather than guess.
 */
export async function resolveOrgByIdentifier(db: Db, identifier: string) {
  if (!identifier) return undefined;

  const matches = await db
    .select()
    .from(organizations)
    .where(
      or(
        eq(organizations.slug, identifier),
        sql`LOWER(${organizations.slug}) = LOWER(${identifier})`,
        sql`LOWER(${organizations.name}) = LOWER(${identifier})`,
      ),
    )
    .limit(2);

  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  // Multiple rows matched. Prefer an exact (case-sensitive) slug match if
  // present so behavior is unchanged for callers that pass the canonical slug.
  const exact = matches.find((o) => o.slug === identifier);
  if (exact) return exact;

  // Otherwise prefer a case-insensitive slug match over a name fallback.
  const slugMatch = matches.find(
    (o) => o.slug.toLowerCase() === identifier.toLowerCase(),
  );
  if (slugMatch) return slugMatch;

  // Ambiguous name match — refuse to guess.
  return undefined;
}
