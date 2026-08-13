import { z } from 'zod';

// a malformed id is the client's mistake, so it is a 400 here rather than a
// 404 from a prisma lookup that was never going to match
export const uuidParamsSchema = z.object({ id: z.uuid() });

export type UuidParams = z.infer<typeof uuidParamsSchema>;
