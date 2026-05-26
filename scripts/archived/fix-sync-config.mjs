import { Client } from "@notionhq/client";

const client = new Client({ auth: process.env.NOTION_API_KEY || process.env.Notion_API_Key });

async function main() {
  // Search for data_sources (databases) that are accessible
  const dsResults = await client.search({ filter: { property: "object", value: "data_source" }, page_size: 50 });
  console.log("Data sources found:", dsResults.results.length);
  
  const liveDS = dsResults.results.filter((d) => d.archived === false);
  console.log("Non-archived data sources:", liveDS.length);
  
  for (const d of liveDS.slice(0, 10)) {
    const title = d.title?.[0]?.plain_text || "(no title)";
    console.log("  -", d.id, "|", title, "| parent:", JSON.stringify(d.parent));
  }

  // Search for pages (non-database rows) 
  const pageResults = await client.search({ filter: { property: "object", value: "page" }, page_size: 100 });
  console.log("\nPages found:", pageResults.results.length);
  
  // Find pages whose parent is a workspace or a page (not a database)
  const standalonePgs = pageResults.results.filter(
    (p) => p.archived === false && p.parent.type === "workspace"
  );
  console.log("Workspace-level pages:", standalonePgs.length);

  // Find pages whose parent is a page (sub-pages)
  const subPages = pageResults.results.filter(
    (p) => p.archived === false && p.parent.type === "page_id"
  );
  console.log("Sub-pages:", subPages.length);
  for (const p of subPages.slice(0, 5)) {
    const props = p.properties || {};
    const titleProp = Object.values(props).find(v => v.type === "title");
    const title = titleProp?.title?.[0]?.plain_text || "(no title)";
    console.log("  -", p.id, "|", title, "| parent:", p.parent.page_id);
  }

  // Try to find a live data_source with a page_id parent we can use
  const dsWithPageParent = liveDS.filter(d => d.parent?.type === "page_id");
  console.log("\nData sources with page_id parent:", dsWithPageParent.length);
  
  if (dsWithPageParent.length > 0) {
    const parentPageId = dsWithPageParent[0].parent.page_id;
    console.log("Using parent page_id:", parentPageId);
    
    try {
      const newDb = await client.databases.create({
        parent: { type: "page_id", page_id: parentPageId },
        is_inline: false,
        title: [{ text: { content: "Questionnaire Sync Config v2" } }],
        properties: {
          Name: { title: {} },
          "Last Successful Sync": { date: {} },
          "Consecutive Failures": { number: {} },
          Enabled: { checkbox: {} },
        },
      });
      console.log("New DB created:", newDb.id);

      const page = await client.pages.create({
        parent: { database_id: newDb.id },
        properties: {
          Name: { title: [{ text: { content: "Sync Config" } }] },
          "Last Successful Sync": { date: { start: new Date().toISOString() } },
          "Consecutive Failures": { number: 0 },
          Enabled: { checkbox: true },
        },
      });
      console.log("New Config Page created:", page.id);
      console.log("");
      console.log("=== UPDATE THESE ENV VARS ===");
      console.log("NOTION_SYNC_CONFIG_PAGE_ID =", page.id);
      console.log("NOTION_SYNC_CONFIG_DATASOURCE_ID =", newDb.id);
    } catch (e) {
      console.error("Create DB error:", e.message);
    }
  } else {
    // Try creating a new page first, then a DB inside it
    console.log("\nNo data sources with page parent. Trying to create a page first...");
    
    // Use the connectivity datasource ID as parent since we know it works
    const connDsId = process.env.NOTION_CONNECTIVITY_DATASOURCE_ID;
    console.log("Connectivity DS ID:", connDsId);
    
    if (connDsId) {
      try {
        const connDs = await client.databases.retrieve({ database_id: connDsId });
        console.log("Connectivity DS parent:", JSON.stringify(connDs.parent));
        
        if (connDs.parent?.page_id) {
          const parentPageId = connDs.parent.page_id;
          console.log("Using connectivity parent page:", parentPageId);
          
          const newDb = await client.databases.create({
            parent: { type: "page_id", page_id: parentPageId },
            is_inline: false,
            title: [{ text: { content: "Questionnaire Sync Config v2" } }],
            properties: {
              Name: { title: {} },
              "Last Successful Sync": { date: {} },
              "Consecutive Failures": { number: {} },
              Enabled: { checkbox: {} },
            },
          });
          console.log("New DB created:", newDb.id);

          const page = await client.pages.create({
            parent: { database_id: newDb.id },
            properties: {
              Name: { title: [{ text: { content: "Sync Config" } }] },
              "Last Successful Sync": { date: { start: new Date().toISOString() } },
              "Consecutive Failures": { number: 0 },
              Enabled: { checkbox: true },
            },
          });
          console.log("New Config Page created:", page.id);
          console.log("");
          console.log("=== UPDATE THESE ENV VARS ===");
          console.log("NOTION_SYNC_CONFIG_PAGE_ID =", page.id);
          console.log("NOTION_SYNC_CONFIG_DATASOURCE_ID =", newDb.id);
        }
      } catch (e) {
        console.error("Connectivity approach error:", e.message);
      }
    }
    
    console.log("\nIf all else fails, you need to manually restore the 'Questionnaire Sync Config' database from Notion trash.");
  }
}

main().catch(console.error);
