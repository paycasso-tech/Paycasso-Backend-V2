import type { Request, Response, NextFunction } from "express";
// import { verifyAccessToken } from "../utils/auth.utils";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../utils/auth/auth.utils";

const prisma = new PrismaClient();

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        username: string;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Invalid token format" });
    }
    
    const payload = verifyAccessToken(token);

    if (!payload) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, username: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User not found or inactive" });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      username: user.username,
    };

    next();
  } catch (error) {
    console.error("[auth.middleware] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Forbidden: Admin access required" });
    }

    next();
  } catch (error) {
    console.error("[auth.middleware] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
