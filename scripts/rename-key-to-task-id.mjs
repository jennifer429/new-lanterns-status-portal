import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = "20145e64-99de-4436-829e-e8b70de1bed0";

async function renameProperty() {
  try {
    // Update the database to rename the property
    const response = await notion.databases.update({
      database_id: databaseId,
      properties: {
        "Task ID": {
          name: "Task ID",
          type: "rich_text",
        },
      },
    });
    console.log("✓ Property renamed successfully");
    console.log(JSON.stringify(response.properties, null, 2));
  } catch (error) {
    console.error("✗ Failed to rename property:", error.message);
  }
}

renameProperty();
