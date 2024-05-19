import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { DEFAULT_TITLE, JWT_SIGN, TOTAL_DECIMALS } from "../utils/constants";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authMiddleware } from "../middleware/auth";
import { createTaskInput } from "../utils/type";
import dotenv from "dotenv";

dotenv.config({ path: __dirname + "/.env" });

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.SECRET_KEY_ID ?? "",
  },
  region: "us-west-1",
});

const router = Router();

const prismaClient = new PrismaClient();

router.post("/signin", async (req, res) => {
  const hardcoded_wallet_address =
    "Gf3EqdA5vAfGYrM8HfaBEEHVp28AahsH9GPMQair4ax4";

  const existingUser = await prismaClient.user.findFirst({
    where: {
      address: hardcoded_wallet_address,
    },
  });

  if (existingUser) {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      JWT_SIGN
    );

    res.json({
      token,
    });
  } else {
    const user = await prismaClient.user.create({
      data: {
        address: hardcoded_wallet_address,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SIGN
    );

    res.json({
      token,
    });
  }
});

router.post("/task", authMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;
  const body = req.body;
  const parseData = createTaskInput.safeParse(body);

  if (!parseData.success) {
    return res.status(411).json({
      message: "You've sent the wrong data",
    });
  }

  const response = await prismaClient.$transaction(async (tx) => {
    const response = await prismaClient.task.create({
      data: {
        title: parseData.data.title ?? DEFAULT_TITLE,
        amount: 1 * TOTAL_DECIMALS,
        signature: parseData.data.signature,
        user_id: userId,
      },
    });

    await tx.option.createMany({
      data: parseData.data.options.map((x) => ({
        image_url: x.imageUrl,
        task_id: response.id,
      })),
    });

    return response;
  });

  res.json({
    id: response.id,
  });
});

router.get("/task", authMiddleware, async (req, res) => {
  //@ts-ignore
  const taskId: string = req.query.taskId;
  //@ts-ignore
  const userId = req.userId;

  const taskDetails = await prismaClient.task.findFirst({
    where: {
      user_id: Number(userId),
      id: Number(taskId),
    },
    include: {
      options: true,
    },
  });

  if (!taskDetails) {
    return res.status(411).json({
      message: "You don't have access to this task",
    });
  }

  const responses = await prismaClient.submission.findMany({
    where: {
      task_id: Number(taskId),
    },
    include: {
      option: true,
    },
  });

  const result: Record<
    string,
    { count: number; option: { imageUrl: string } }
  > = {};

  taskDetails.options.forEach((option) => {
    result[option.id] = {
      count: 0,
      option: {
        imageUrl: option.image_url,
      },
    };
  });

  responses.forEach((r) => {
    result[r.option_id].count++;
  });

  res.json({
    result,
  });
});

router.post("/presignedUrl", authMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;

  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: "s3-stored-image.jarwiz.com",
    Key: `fiver/${userId}/${Math.random()}/image.jpg`,
    Conditions: [
      ["content-length-range", 0, 5 * 1024 * 1024], // 5 MB max
    ],
    Expires: 3600,
  });

  res.json({
    preSignedUrl: url,
    fields,
  });
});

export default router;
