import { useRoute } from "wouter";

/**
 * Extracts the partner-scoped org params (clientSlug + slug) from the current route.
 *
 * Usage:
 *   const { clientSlug, slug, orgPath } = useOrgParams("implement");
 *   // orgPath === "/org/RadOne/my-hospital"
 *
 * @param subPath  The path segment after /:slug, e.g. "implement", "intake". Omit for the root org route.
 */
export function useOrgParams(subPath?: string) {
  const routePath = subPath
    ? `/org/:clientSlug/:slug/${subPath}`
    : "/org/:clientSlug/:slug";

  const [, params] = useRoute(routePath);
  const p = params as Record<string, string> | undefined;

  const clientSlug = p?.clientSlug ?? "";
  const slug = p?.slug ?? "";
  const orgPath = `/org/${clientSlug}/${slug}`;

  return { clientSlug, slug, orgPath };
}
