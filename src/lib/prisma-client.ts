import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/monitoring";

function validateDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL;
  
  // Skip validation during build time (Next.js static generation) and tests
  if (process.env.NODE_ENV === 'test' || process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  if (!dbUrl) {
    throw new Error(
      "Missing DATABASE_URL environment variable. Set DATABASE_URL in your .env.local (e.g. DATABASE_URL=postgresql://user:password@localhost:5432/eipsinsight) and restart the dev server."
    );
  }

  // Trim whitespace and strip surrounding single/double quotes if present
  const normalized = dbUrl.trim().replace(/^['"]|['"]$/g, "");
  if (!/^postgres(?:ql)?:\/\//i.test(normalized)) {
    throw new Error(
      `Invalid DATABASE_URL: '${normalized}'. Prisma expects a Postgres connection string starting with 'postgresql://' or 'postgres://'. Example: 'postgresql://user:password@localhost:5432/eipsinsight'`
    );
  }
}

validateDatabaseUrl();

/**
 * Append PgBouncer-compatible parameters to the connection URL so that Prisma
 * does NOT use named prepared statements.  Without this, concurrent serverless
 * invocations (Vercel / Supabase) hit PostgreSQL error 42P05
 * ("prepared statement already exists").
 */
function buildConnectionUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const cleaned = raw.trim().replace(/^['"']|['"']$/g, "");
  try {
    const url = new URL(cleaned);
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    // In dev, allow more concurrent connections to avoid request serialization.
    // In production (serverless), keep it at 1 per invocation.
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", process.env.NODE_ENV === "development" ? "5" : "1");
    }
    // Fail fast if Supabase pooler is slow to accept (e.g. cold-start).
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "15");
    }
    // Don't wait forever for a pooled connection slot.
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "15");
    }
    return url.toString();
  } catch {
    return cleaned;
  }
}

const dbUrl = buildConnectionUrl(process.env.DATABASE_URL);

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,        // includes ?pgbouncer=true&connection_limit=1
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const start = performance.now();
        try {
          const result = await query(args);
          const end = performance.now();
          const duration = end - start;
          
          if (process.env.DEBUG_PRISMA === "true" || process.env.NODE_ENV === "development") {
            logger.debug(`${model}.${operation} took ${duration.toFixed(2)}ms`, "Prisma");
          }
          
          return result;
        } catch (error) {
          const end = performance.now();
          logger.error(`${model}.${operation} failed after ${(end - start).toFixed(2)}ms`, "Prisma", undefined, error);
          throw error;
        }
      },
    },
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientSingleton | undefined };

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;