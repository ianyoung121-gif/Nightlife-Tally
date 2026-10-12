import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { authMiddleware } from "./middlewares/authMiddleware";
import { SESSION_COOKIE } from "./lib/auth";
import { getStripeSync } from "./stripeClient";

const app: Express = express();
const allowedOrigins = new Set(
  [
    ...((process.env.REPLIT_DOMAINS ?? "").split(",").filter(Boolean).map((domain) => `https://${domain}`)),
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined,
    process.env.REPLIT_EXPO_DEV_DOMAIN ? `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}` : undefined,
  ].filter((origin): origin is string => Boolean(origin)),
);

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    callback(null, !origin || isAllowedOrigin(origin));
  },
};

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors(corsOptions));
app.use(cookieParser());
app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const signature = req.get("stripe-signature");
  if (!signature || !Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: "Invalid webhook request" }); return;
  }
  try {
    await (await getStripeSync()).processWebhook(req.body, signature);
    res.json({ received: true });
  } catch {
    res.status(400).json({ error: "Webhook could not be verified or processed" });
  }
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const unsafeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const hasBearerToken = req.headers.authorization?.startsWith("Bearer ");
  const isCookieSession = Boolean(req.cookies?.[SESSION_COOKIE]);
  if (!unsafeMethod || hasBearerToken || !isCookieSession) {
    next();
    return;
  }

  const origin = req.get("origin");
  if (!origin || !isAllowedOrigin(origin)) {
    res.status(403).json({ error: "Invalid request origin" });
    return;
  }
  next();
});
if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY }));
}
app.use(authMiddleware);

app.use("/api", router);

export default app;
