import { drizzle } from "drizzle-orm/mysql2";
import { organizations } from "../drizzle/schema.js";
import "dotenv/config";

async function seedDemoOrg() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const db = drizzle(process.env.DATABASE_URL);

  try {
    // Create demo organization
    const [result] = await db.insert(organizations).values({
      name: "Memorial General Hospital",
      slug: "demo",
      contactName: "Dr. Sarah Chen",
      contactEmail: "sarah.chen@memorialgeneral.org",
      contactPhone: "(555) 123-4567",
      startDate: "January 15, 2026",
      goalDate: "March 1, 2026",
    });

    console.log("✅ Demo organization created successfully!");
    console.log(`   Organization ID: ${result.insertId}`);
    console.log(`   Access URL: /org/demo`);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      console.log("ℹ️  Demo organization already exists");
    } else {
      console.error("❌ Error creating demo organization:", error);
      process.exit(1);
    }
  }

  process.exit(0);
}

seedDemoOrg();
