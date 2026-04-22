import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { hashForAudit } from "../lib/crypto.js";

export interface AuditEntry {
  tableName: string;
  recordId: string;
  changedBy: string;
  fieldName: string;
  oldValue?: string | null;
  newValue?: string | null;
  req: Request;
}

/**
 * Skriv en rad till audit_log. Känsliga värden hashas (sha256) så att
 * loggen inte blir en kopia av originaldatan.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tableName: entry.tableName,
      recordId: entry.recordId,
      changedBy: entry.changedBy,
      fieldName: entry.fieldName,
      oldValueHash: entry.oldValue ? hashForAudit(entry.oldValue) : null,
      newValueHash: entry.newValue ? hashForAudit(entry.newValue) : null,
      ipAddress: (entry.req.ip ?? "unknown").toString(),
      userAgent: entry.req.get("user-agent") ?? "unknown",
    },
  });
}
