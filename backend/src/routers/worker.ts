import { Router } from "express";
import { PrismaClient } from "@prisma/client";
const prismaClient = new PrismaClient();
import jwt from "jsonwebtoken";
import {
  JWT_SIGN_WORKER,
  TOTAL_DECIMALS,
  TOTAL_SUBMISSIONS,
} from "../utils/constants";
import { workerAuthMiddleware } from "../middleware/auth";
import { getTasks } from "../utils/db";
import { createSubmissionInput } from "../utils/type";

const router = Router();

router.post("/signin", async (req, res) => {
  const hardcoded_wallet_address =
    "Gf3EqdA5vAfGYrM8HfaBEEHVp28AahsH9GPMQair4ax4";

  const existingUser = await prismaClient.worker.findFirst({
    where: {
      address: hardcoded_wallet_address,
    },
  });

  if (existingUser) {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      JWT_SIGN_WORKER
    );

    res.json({
      token,
    });
  } else {
    const user = await prismaClient.worker.create({
      data: {
        address: hardcoded_wallet_address,
        locked_amount: 0,
        pending_amount: 0,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SIGN_WORKER
    );

    res.json({
      token,
    });
  }
});

router.get("/nextTask", workerAuthMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;

  const task = await getTasks(Number(userId));

  if (!task) {
    res.status(411).json({
      message: "No more task left for you to review",
    });
  } else {
    res.status(411).json({
      task,
    });
  }
});

router.post("/payout", workerAuthMiddleware, async (req, res) => {
  // @ts-ignore

  const userId = req.userId;

  const worker = await prismaClient.worker.findFirst({
    where: { id: Number(userId) },
  });

  if (!worker) {
    return res.status(401).json({
      message: "login first",
    });
  }

  const address = worker.address;

  const txnId = "0x238492332";

  await prismaClient.$transaction(async (tx) => {
    await tx.worker.update({
      where: {
        id: Number(userId),
      },
      data: {
        pending_amount: {
          decrement: worker?.pending_amount,
        },
        locked_amount: {
          increment: worker?.locked_amount,
        },
      },
    });

    await tx.payouts.create({
      data: {
        user_id: Number(userId),
        amount: worker.pending_amount,
        status: "Processing",
        signature: txnId,
      },
    });
  });

  //
  res.json({
    message: "processing payout",
    amount: worker.pending_amount,
  });
});

router.get("/balance", workerAuthMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;

  const worker = await prismaClient.worker.findFirst({
    where: {
      id: userId,
    },
  });

  res.json({
    pending_amount: worker?.pending_amount,
    locked_amount: worker?.locked_amount,
  });
});

router.post("/submission", workerAuthMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;
  const body = req.body;

  const parsedBody = createSubmissionInput.safeParse(body);

  if (parsedBody.success) {
    const task = await getTasks(Number(userId));

    if (!task || task?.id !== Number(parsedBody.data.taskId)) {
      return res.status(411).json({
        message: "Incorrect task id",
      });
    }

    const amount = task.amount / TOTAL_SUBMISSIONS;

    const submission = await prismaClient.$transaction(async (tx) => {
      const submission = await tx.submission.create({
        data: {
          option_id: Number(parsedBody.data.selection),
          worker_id: userId,
          task_id: Number(parsedBody.data.taskId),
          amount,
        },
      });

      await tx.worker.update({
        where: {
          id: userId,
        },
        data: {
          pending_amount: {
            increment: Number(amount),
          },
        },
      });

      return submission;
    });

    const nextTask = await getTasks(Number(userId));
    res.json({
      nextTask,
      amount,
    });
  } else {
    res.status(411).json({
      message: "Incorrect inputs",
    });
  }
});

export default router;
