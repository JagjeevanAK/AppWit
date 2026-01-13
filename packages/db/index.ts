import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { serverConfig } from "@appwit/config/server";

const pool = new pg.Pool({ connectionString: serverConfig.database.url });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

async function connectPrismaClient() {
    try {
        await prisma.$connect()
    } catch (error) {
        console.log("PRISMA CLIENT COULD NOT CONNECT", error)
    }
}

connectPrismaClient();

export { MessageRole, ProjectStatus, FileType } from "@prisma/client";
export type { User, Session, Project, Chat, Message, File } from "@prisma/client";