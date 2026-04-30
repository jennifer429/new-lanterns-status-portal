/**
 * Match an organization by URL identifier — either its slug or its name.
 *
 * Why both: orgs can be renamed via the admin UI (which only updates `name`,
 * not `slug`). After a rename, internal links built from the live name no
 * longer match the stored slug, and saves/reads start landing on different
 * sides of "not found" — the symptom is data appearing to import but
 * vanishing on refresh.
 *
 * Falling back to a name match keeps every URL-driven lookup tolerant of
 * the slug/name divergence without forcing a destructive slug rename.
 */
import { or, eq } from "drizzle-orm";
import { organizations } from "../../drizzle/schema";

export function orgIdentifierMatches(identifier: string) {
  return or(
    eq(organizations.slug, identifier),
    eq(organizations.name, identifier),
  );
}
