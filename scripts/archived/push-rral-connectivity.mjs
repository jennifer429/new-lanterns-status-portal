/**
 * Push RRAL connectivity data from the intake responses file to Notion.
 * This reads the CONN.endpoints from the uploaded JSON and creates pages
 * in the Integration Connection Registry Notion database.
 */
import { Client } from "@notionhq/client";
import { readFileSync } from "fs";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = "6ffd2b0d-18bd-41cf-af53-73b4209e5099";
const ORG_NAME = "RRAL";

const client = new Client({ auth: NOTION_API_KEY });

// Read the file
const data = JSON.parse(readFileSync("/home/ubuntu/upload/RRAL-intake-responses-filled.json", "utf8"));
const endpoints = data.responses["CONN.endpoints"];

console.log(`Found ${endpoints.length} RRAL connectivity endpoints to push to Notion`);

// First, archive the existing empty RRAL row
console.log("\n--- Archiving existing empty RRAL row ---");
const DATA_SOURCE_ID = "53f78f54-2908-43d4-b471-df049652d470";
const existing = await client.dataSources.query({
  data_source_id: DATA_SOURCE_ID,
  page_size: 100,
  filter: { property: "Institution Group", multi_select: { contains: "RRAL" } }
});
for (const page of existing.results) {
  console.log(`  Archiving page ${page.id}`);
  await client.pages.update({ page_id: page.id, archived: true });
}

// Map traffic types from the portal format to Notion select options
function mapTrafficType(t) {
  const map = {
    "HL7 - Orders (ORM)": "HL7 ORM",
    "HL7 - Results (ORU)": "HL7 ORU^R01",
    "HL7 - Inbound Listener (Prime side)": "HL7 ORM",
    "HL7 - Orders/Results (ORM + ORU)": "HL7 ORM",
    "DICOM - Query/Retrieve (Priors)": "DICOM C-FIND/C-MOVE",
    "HL7 - Billing (ORM/ORU)": "HL7 ORM",
  };
  return map[t] || null; // Return null if no match, we'll use rich_text for Flow Name instead
}

// Determine direction from source/dest
function inferDirection(src, dst) {
  const srcLower = (src || "").toLowerCase();
  const dstLower = (dst || "").toLowerCase();
  if (srcLower.includes("new lantern") || srcLower.includes("silverback")) {
    if (dstLower.includes("epic") || dstLower.includes("prime") || dstLower.includes("infinitt")) {
      return "NL → Site";
    }
  }
  if (dstLower.includes("new lantern") || dstLower.includes("silverback")) {
    return "Site → NL";
  }
  return null;
}

// Create new rows
console.log("\n--- Creating RRAL connectivity rows in Notion ---");
let created = 0;
let errors = [];

for (const ep of endpoints) {
  const flowName = ep.trafficType || `${ep.sourceSystem} → ${ep.destinationSystem}`;
  const protocolType = mapTrafficType(ep.trafficType);
  
  // Build ENV value
  let envValue = null;
  if (ep.envTest && ep.envProd) envValue = "Both";
  else if (ep.envProd) envValue = "Prod";
  else if (ep.envTest) envValue = "Test";

  // Build IP/Port combined fields
  const senderIpPort = ep.sourcePort ? `${ep.sourceIp}:${ep.sourcePort}` : ep.sourceIp || "";
  const receiverIpPort = ep.destPort ? `${ep.destIp}:${ep.destPort}` : ep.destIp || "";

  const direction = inferDirection(ep.sourceSystem, ep.destinationSystem);

  const properties = {
    "Flow Name": { title: [{ text: { content: flowName } }] },
    "Sender System / AE Title": { rich_text: [{ text: { content: ep.sourceSystem || "" } }] },
    "Receiver System / AE Title": { rich_text: [{ text: { content: ep.destinationSystem || "" } }] },
    "Sender IP / Port": { rich_text: [{ text: { content: senderIpPort } }] },
    "Receiver IP / Port": { rich_text: [{ text: { content: receiverIpPort } }] },
    "SRC AE Title": { rich_text: [{ text: { content: ep.sourceAeTitle || "" } }] },
    "DST AE Title": { rich_text: [{ text: { content: ep.destAeTitle || "" } }] },
    "Notes": { rich_text: [{ text: { content: ep.notes || "" } }] },
    "Institution Group": { multi_select: [{ name: ORG_NAME }] },
    "Rad Group": { rich_text: [{ text: { content: "SRV" } }] },
    "Status": { select: { name: "🟡 Testing" } },
  };

  // Only set select fields if we have a valid option
  if (protocolType) {
    properties["Protocol / Message Type"] = { select: { name: protocolType } };
  }
  if (envValue) {
    properties["ENV"] = { select: { name: envValue } };
  }
  if (direction) {
    properties["Direction"] = { select: { name: direction } };
  }

  try {
    const result = await client.pages.create({
      parent: { database_id: DATABASE_ID },
      properties,
    });
    created++;
    console.log(`  ✓ Created: ${flowName} (${ep.sourceSystem} → ${ep.destinationSystem}) [${envValue || "no env"}]`);
  } catch (err) {
    errors.push({ flowName, error: err.message });
    console.error(`  ✗ Failed: ${flowName} — ${err.message}`);
  }
}

console.log(`\n--- Done ---`);
console.log(`Created: ${created}/${endpoints.length}`);
if (errors.length > 0) {
  console.log(`Errors: ${errors.length}`);
  errors.forEach(e => console.log(`  - ${e.flowName}: ${e.error}`));
}
