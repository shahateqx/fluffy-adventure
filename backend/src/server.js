import express from "express";
import path from "path";
import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";


const app = express();

const __dirname = path.resolve();


app.get("/selected", (req, res) => {
  res.status(200).json({ message: "Hello, Sahat. You're selected!" });
});

app.get("/session", (req, res) => {
  res.status(200).json({ message: "Wait for your session!" });
});

if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

const startServer = async () => {
  try {
    await connectDB();
    app.listen(ENV.PORT, () => console.log("Server is running on port:", ENV.PORT));
  } catch (error) {
    console.error("🛑 Error starting the server", error);
  }
};

startServer();