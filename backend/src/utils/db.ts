import { PrismaClient } from "@prisma/client";
const prismaClient = new PrismaClient();

export async function getTasks(userId: number) {
  const tasks = await prismaClient.task.findFirst({
    where: {
      done: false,
      submissions: {
        none: {
          worker_id: userId,
        },
      },
    },
    select: {
      id: true,
      amount: true,
      title: true,
      options: true,
    },
  });
  return tasks;
}
