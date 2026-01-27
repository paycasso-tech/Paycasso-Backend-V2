import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import path from "path";
import { userRoutes, transferRoutes, disputeRoutes } from "./routes";
import { DisputeService } from "./services/dispute.service";
import { setupFaucet } from "./services/coinbase.service/coinbase.services";
dotenv.config();

const swaggerDocument = JSON.parse(readFileSync(path.join(process.cwd(), "src/swagger.json"), "utf8"));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
const initServices = async () => {
  try {
    await setupFaucet(); // From your V2 repo

    const disputeService = new DisputeService();


    console.log(" All Services Initialized");
  } catch (error) {
    console.error(" Service Initialization Failed", error);
  }
};

initServices();
app.use("/api/user", userRoutes);
app.use("/api/transfer", transferRoutes);
app.use("/api/dispute", disputeRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
})