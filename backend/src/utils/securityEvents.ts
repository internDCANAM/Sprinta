import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface SecurityEventInput {
    req: Request;
    eventType: string;
    severity: Severity;
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
                ipAddress: req.ip ?? "unknown",
                userAgent: req.get("user-agent") ?? "unknown",
                path: req.originalUrl,
                method: req.method,
                metadata,
            },
        });

        logger.warn("Security event recorded", {
            eventType,
            severity,
            ip: req.ip,
            path: req.originalUrl,
            method: req.method,
        });
    } catch (err) {
        logger.error("Failed to record security event", {
            eventType,
            message: err instanceof Error ? err.message : String(err),
        });
    }
}