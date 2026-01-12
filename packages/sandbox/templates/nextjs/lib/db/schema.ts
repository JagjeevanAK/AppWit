import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Example: Define your database schema here
// The agent will extend this schema based on the user's requirements

export const items = pgTable("items", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tips for extending the schema:
// - Use serial("id").primaryKey() for auto-incrementing IDs
// - Use text("field") for strings
// - Use integer("field") for numbers
// - Use timestamp("field").defaultNow() for timestamps
// - Use boolean("field").default(false) for booleans
// - Use .references(() => otherTable.id) for foreign keys
