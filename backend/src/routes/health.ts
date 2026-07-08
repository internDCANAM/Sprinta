import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/http.js";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    let db: "connected" | "disconnected" = "disconnected";
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "connected";
    } catch {
      db = "disconnected";
    }
    res.json({ status: "ok", db });
  }),
);
