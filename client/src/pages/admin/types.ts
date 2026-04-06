import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;

export type Org = RouterOutput["admin"]["getAllOrganizations"][number];
export type Client = RouterOutput["admin"]["getAllClients"][number];
export type AdminUser = RouterOutput["admin"]["getAllUsers"][number];
export type Metric = RouterOutput["admin"]["getAdminSummary"][number];

export type SharedAdminProps = {
  isPlatformAdmin: boolean;
  orgs: Org[];
  refetchOrgs: () => void;
  clients: Client[];
  allUsers: AdminUser[];
  refetchUsers: () => void;
};
