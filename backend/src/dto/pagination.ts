import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface Collection<T> {
  data: T[];
}

export function buildPagination(page: number, limit: number, total: number): Pagination {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function paginate<T>(
  query: PaginationQuery,
  schema: z.ZodType<T, unknown>,
  count: () => Promise<number>,
  find: (skip: number, take: number) => Promise<unknown[]>
): Promise<Paginated<T>> {
  const { page, limit } = query;
  const [total, rows] = await Promise.all([count(), find((page - 1) * limit, limit)]);
  return {
    data: rows.map((row) => schema.parse(row)),
    pagination: buildPagination(page, limit, total),
  };
}
