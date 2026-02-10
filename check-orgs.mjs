import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { config } from 'dotenv';

config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn, { schema, mode: 'default' });

const orgs = await db.select().from(schema.organizations);
console.log('Existing organizations:');
console.log(JSON.stringify(orgs, null, 2));

await conn.end();
