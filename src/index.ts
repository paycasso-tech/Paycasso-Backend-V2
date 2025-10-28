import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { userRoutes, tranferRoutes } from "./routes";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/user", userRoutes);
app.use("/api/transfer", tranferRoutes);

app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
})