import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SIGN, JWT_SIGN_WORKER } from "../utils/constants";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.header("authorization") ?? "";

  try {
    const decoded = jwt.verify(authHeader, JWT_SIGN);
    //@ts-ignore
    if (decoded.userId) {
      //@ts-ignore
      req.userId = decoded.userId;
      return next();
    }
  } catch (error) {
    return res.status(403).json({
      message: "you are not logged in",
    });
  }
}
export function workerAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.header("authorization") ?? "";

  try {
    const decoded = jwt.verify(authHeader, JWT_SIGN_WORKER);
    //@ts-ignore
    if (decoded.userId) {
      //@ts-ignore
      req.userId = decoded.userId;
      return next();
    }
  } catch (error) {
    return res.status(403).json({
      message: "you are not logged in",
    });
  }
}
