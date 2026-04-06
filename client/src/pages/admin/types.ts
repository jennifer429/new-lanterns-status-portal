import { trpc } from "@/lib/trpc";

// Infer types from tRPC query returns
type OrgsQuery = ReturnType<typeof trpc.admin.getAllOrganizations.useQuery>;
type ClientsQuery = ReturnType<typeof trpc.admin.getAllClients.useQuery>;
type UsersQuery = ReturnType<typeof trpc.admin.getAllUsers.useQuery>;
type MetricsQuery = ReturnType<typeof trpc.admin.getAdminSummary.useQuery>;

export type Org = NonNullable<OrgsQuery["data"]>[number];
export type Client = NonNullable<ClientsQuery["data"]>[number];
export type AdminUser = NonNullable<UsersQuery["data"]>[number];
export type Metric = NonNullable<MetricsQuery["data"]>[number];

export type SharedAdminProps = {
  isPlatformAdmin: boolean;
  orgs: Org[];
  refetchOrgs: () => void;
  clients: Client[];
  allUsers: AdminUser[];
  refetchUsers: () => void;
};


