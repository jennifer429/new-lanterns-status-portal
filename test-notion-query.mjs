import { Client } from "@notionhq/client";

const client = new Client({
  auth: process.env.NOTION_API_KEY,
});

const QUESTIONNAIRE_DATA_SOURCE_ID = "0ee29093-c05c-4fdf-b3ad-bd9e2405b3b7";

async function testQuery() {
  try {
    console.log("Testing Notion query...");
    console.log("Data source ID:", QUESTIONNAIRE_DATA_SOURCE_ID);
    console.log("API Key:", process.env.NOTION_API_KEY ? "SET" : "NOT SET");

    // Try a simple query without filters first
    console.log("\n1. Testing simple query (no filters)...");
    const response1 = await client.dataSources.query({
      data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
      page_size: 10,
    });
    console.log("Simple query results:", response1.results?.length || 0);
    if (response1.results?.length > 0) {
      console.log("First result keys:", Object.keys(response1.results[0]));
      console.log("First result:", JSON.stringify(response1.results[0], null, 2).substring(0, 500));
    }

    // Try with a timestamp filter
    console.log("\n2. Testing query with timestamp filter...");
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    console.log("Querying since:", since);
    const response2 = await client.dataSources.query({
      data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
      filter: {
        timestamp: "last_edited_time",
        last_edited_time: { after: since },
      },
      page_size: 10,
    });
    console.log("Filtered query results:", response2.results?.length || 0);

    // Try with a very old timestamp
    console.log("\n3. Testing query with very old timestamp...");
    const veryOld = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year ago
    console.log("Querying since:", veryOld);
    const response3 = await client.dataSources.query({
      data_source_id: QUESTIONNAIRE_DATA_SOURCE_ID,
      filter: {
        timestamp: "last_edited_time",
        last_edited_time: { after: veryOld },
      },
      page_size: 10,
    });
    console.log("Very old timestamp query results:", response3.results?.length || 0);
  } catch (error) {
    console.error("Error:", error.message || error);
  }
}

testQuery();
