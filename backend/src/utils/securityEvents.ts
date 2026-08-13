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

export const SecurityEventType = {
  LOGIN_RATE_LIMIT_EXCEEDED: 'LOGIN_RATE_LIMIT_EXCEEDED',
  REGISTER_RATE_LIMIT_EXCEEDED: 'REGISTER_RATE_LIMIT_EXCEEDED',
  REFRESH_RATE_LIMIT_EXCEEDED: 'REFRESH_RATE_LIMIT_EXCEEDED',
  API_RATE_LIMIT_EXCEEDED: 'API_RATE_LIMIT_EXCEEDED',
  GLOBAL_RATE_LIMIT_EXCEEDED: 'GLOBAL_RATE_LIMIT_EXCEEDED',
} as const;

export type SecurityEventType = (typeof SecurityEventType)[keyof typeof SecurityEventType];

interface SecurityEventInput {
  req: Request;
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  message: string;
  metadata?: Prisma.InputJsonValue;
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

export interface AuditFieldChangeInput {
  tableName: string;
  recordId: string;
  changedBy: string;
  before: Record<string, string | number | boolean | Date | null | undefined>;
  patch: Record<string, string | number | boolean | Date | null | undefined>;
  req: Request;
}

/**
 * Diffs `patch` against `before` and writes one {@link writeAudit} row per
 * field whose value actually changed.
 *
 * @param patch - Proposed field values, e.g. the same object about to be
 * passed to a Prisma `update`. A field absent (`undefined`) is treated as
 * "not being updated" and skipped, not as "cleared".
 */
function stringifyAuditValue(
  value: string | number | boolean | Date | null | undefined
): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function auditChanges({
  tableName, recordId, changedBy, before, patch, req,
}: AuditFieldChangeInput): Promise<void> {
  const changedFields = Object.entries(patch).filter(
    ([fieldName, value]) => value !== undefined && value !== before[fieldName]
  );

  await Promise.all(
    changedFields.map(([fieldName, newValue]) =>
      writeAudit({
        tableName, recordId, changedBy, fieldName,
        oldValue: stringifyAuditValue(before[fieldName]),
        newValue: stringifyAuditValue(newValue),
        req,
      })
    )
  );
}

export async function recordSecurityEvent({
  req, eventType, severity, message, metadata,
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
