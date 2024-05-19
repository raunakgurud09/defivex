import z, { optional } from "zod";

export const createTaskInput = z.object({
  options: z.array(
    z.object({
      imageUrl: z.string(),
    })
  ),
  title: z.string().optional(),
  signature: z.string(),
});

export const createSubmissionInput = z.object({
  taskId: z.string(),
  signature: z.string().optional(),
  selection: z.string(),
});
