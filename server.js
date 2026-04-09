require("dotenv").config();
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Dziala Express 🚀");
});

app.get("/api", (req, res) => {
  res.json({ message: "To jest API" });
});

app.listen(port, () => {
  console.log(`Serwer działa na http://localhost:${port}`);
});