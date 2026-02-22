// Get organization and its parent client
const [org] = await db
  .select()
  .from(organizations)
  .where(eq(organizations.id, input.organizationId))
  .limit(1);

if (!org) throw new Error("Organization not found");

// Determine folder path based on role
let fileKey: string;

if (!org.clientId) {
  // NL Admin - goes to New Lantern folder
  fileKey = `New Lantern/${Date.now()}-${input.fileName}`;
} else {
  // Get partner/client name
  const { clients } = await import("../../drizzle/schema");
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, org.clientId))
    .limit(1);

  const partnerName = client?.name || `client-${org.clientId}`;

  if (input.organizationId) {
    // Customer upload - partner/customer/file
    fileKey = `${partnerName}/${org.name}/${Date.now()}-${input.fileName}`;
  } else {
    // Partner upload - partner/file
    fileKey = `${partnerName}/${Date.now()}-${input.fileName}`;
  }
}

const { storagePut } = await import("../storage");
const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);
