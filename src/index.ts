import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";  

import { userRoutes, tranferRoutes } from "./routes";



dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/openapi.json", (req, res) => res.json(swaggerSpec));


app.use("/api/user", userRoutes);
app.use("/api/transfer", tranferRoutes);

app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
})