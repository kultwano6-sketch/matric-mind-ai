import express from "express";
import cors from "cors";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Backend is running");
  });

  // AI route
  app.post("/api/ai", (req, res) => {
    const { prompt } = req.body;

      const reply = `AI says: ${prompt}`;

        res.json({ reply });
        });

        // Start server
        app.listen(3001, () => {
          console.log("Server running on http://localhost:3001");
          });