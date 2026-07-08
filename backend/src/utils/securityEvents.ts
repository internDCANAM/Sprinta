import type { Request } from 'express';
import { logger } from '../lib/logger.js';
import { Prisma } from '../../prisma/generated/prisma/client.js';
import type { SecurityEventSeverity } from '../../prisma/generated/prisma/enums.js';
import { prisma } from '../lib/prisma.js';
import { hashForAudit } from '../lib/crypto.js';

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
 * Writes one row to audit_log. Sensitive values are hashed (sha256) so the
 * log never becomes a copy of the original data.
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
      ipAddress: (entry.req.ip ?? 'unknown').toString(),
      userAgent: entry.req.get('user-agent') ?? 'unknown',
    },
  });
}

interface SecurityEventInput {
  req: Request;
  eventType: string;
  severity: SecurityEventSeverity;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

export async function recordSecurityEvent({
  req,
  eventType,
  severity,
  message,
  metadata,
}: SecurityEventInput): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        eventType,
        severity,
        message,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.get('user-agent') ?? 'unknown',
        path: req.originalUrl,
        method: req.method,
        metadata,
      },
    });

    logger.warn('Security event recorded', {
      eventType,
      severity,
      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
    });
  } catch (err) {
    logger.error('Failed to record security event', {
      eventType,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
