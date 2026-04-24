import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { WorkflowDiagram, type WorkflowConfiguration } from "./WorkflowDiagram";

type WorkflowType = "orders" | "images" | "priors" | "reports";

interface Props {
  organizationSlug: string;
  workflowType: WorkflowType;
}

const SOURCE_KEY = "source";
const MIDDLEWARE_KEY = "middleware";
const DESTINATION_KEY = "destination";

/**
 * Wraps WorkflowDiagram with persistence backed by the workflowPathways table.
 * Each swim-lane pathway is stored as its own row, keyed by (org, workflowType, pathId).
 */
export function PersistedWorkflowDiagram({ organizationSlug, workflowType }: Props) {
  const utils = trpc.useUtils();
  const listQuery = trpc.workflowPathways.list.useQuery({ organizationSlug, workflowType });
  const upsert = trpc.workflowPathways.upsert.useMutation({
    onSuccess: () => utils.workflowPathways.list.invalidate({ organizationSlug, workflowType }),
  });

  const configuration = useMemo<WorkflowConfiguration>(() => {
    const paths: Record<string, boolean> = {};
    const systems: Record<string, string> = {};
    const notes: Record<string, string> = {};
    for (const row of listQuery.data ?? []) {
      paths[row.pathId] = row.enabled === 1;
      if (row.sourceSystem) systems[`${row.pathId}.${SOURCE_KEY}`] = row.sourceSystem;
      if (row.middlewareSystem) systems[`${row.pathId}.${MIDDLEWARE_KEY}`] = row.middlewareSystem;
      if (row.destinationSystem) systems[`${row.pathId}.${DESTINATION_KEY}`] = row.destinationSystem;
      if (row.notes) notes[row.pathId] = row.notes;
    }
    return { paths, systems, notes };
  }, [listQuery.data]);

  const parseKey = (key: string): { pathId: string; slot?: string } => {
    const idx = key.indexOf(".");
    if (idx === -1) return { pathId: key };
    return { pathId: key.slice(0, idx), slot: key.slice(idx + 1) };
  };

  const handleChange = (next: WorkflowConfiguration) => {
    const prev = configuration;
    const touched = new Set<string>();

    for (const k of Object.keys(next.paths)) {
      if (next.paths[k] !== prev.paths[k]) touched.add(k);
    }
    for (const k of Object.keys(next.notes)) {
      if ((next.notes[k] ?? "") !== (prev.notes[k] ?? "")) touched.add(k);
    }
    for (const k of Object.keys(next.systems)) {
      if ((next.systems[k] ?? "") !== (prev.systems[k] ?? "")) {
        touched.add(parseKey(k).pathId);
      }
    }

    touched.forEach((pathId) => {
      upsert.mutate({
        organizationSlug,
        workflowType,
        pathId,
        enabled: next.paths[pathId] ?? false,
        sourceSystem: next.systems[`${pathId}.${SOURCE_KEY}`] ?? null,
        middlewareSystem: next.systems[`${pathId}.${MIDDLEWARE_KEY}`] ?? null,
        destinationSystem: next.systems[`${pathId}.${DESTINATION_KEY}`] ?? null,
        notes: next.notes[pathId] ?? null,
      });
    });
  };

  return (
    <WorkflowDiagram
      workflowType={workflowType}
      configuration={configuration}
      onConfigurationChange={handleChange}
    />
  );
}
