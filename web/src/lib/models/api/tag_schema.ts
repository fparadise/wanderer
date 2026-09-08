import { z, ZodType } from "zod";
import type { SummitLog } from "../summit_log";
import type { Tag } from "../tag";


const TagCreateSchema = z.object({
    id: z.string().length(15).optional(),
    name: z.string(),
    editorial: z.boolean().optional()
}) satisfies ZodType<Tag>

const TagUpdateSchema = z.object({
    name: z.string().optional(),
    editorial: z.boolean().optional()
}) satisfies ZodType<Partial<Tag>>

export { TagCreateSchema, TagUpdateSchema };
