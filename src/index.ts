import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import { transferRoutes, disputeRoutes } from "./routes";
import { DisputeService } from "./services/dispute.service";
import { setupFaucet } from "./services/coinbase.service/coinbase.services";
import { swaggerSpec } from "./configs/swagger.config";
import walletRoutes from "./routes/wallet.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Swagger Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Paycasso API Documentation",
    customfavIcon: "/favicon.ico",
  })
);

// Swagger JSON endpoint
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

const initServices = async () => {
  try {
    // Setup faucet (non-critical, continue if it fails)
    try {
      await setupFaucet();
      console.log("✅ Faucet initialized");
    } catch (faucetError) {
      const errorMessage = faucetError instanceof Error ? faucetError.message : String(faucetError);
      console.warn(
        "⚠️  Faucet setup failed (non-critical):",
        errorMessage
      );
      console.log("→  Faucet features will be unavailable");
    }

    // Setup dispute service
    const disputeService = new DisputeService();
    disputeService.startListeners();

    console.log("✅ All Core Services Initialized");
  } catch (error) {
    console.error("❌ Critical Service Initialization Failed", error);
  }
};


initServices();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/transfer", transferRoutes);
app.use("/api/dispute", disputeRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Paycasso API",
    version: "1.0.0",
    documentation: `http://localhost:${PORT}/api-docs`,
    endpoints: {
      health: "/health",
      apiDocs: "/api-docs",
      auth: "/api/auth",
      user: "/api/user",
      transfer: "/api/transfer",
      dispute: "/api/dispute",
    },
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     🚀 PAYCASSO API SERVER RUNNING       ║
╠═══════════════════════════════════════════╣
║  Port:           ${PORT}                     ║
║  Environment:    ${process.env.APP_ENV || "development"}              ║
║  API Docs:       http://localhost:${PORT}/api-docs  ║
║  Health Check:   http://localhost:${PORT}/health    ║
╚═══════════════════════════════════════════╝
  `);
});

export default app;
