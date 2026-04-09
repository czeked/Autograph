require("dotenv").config();
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Dziala Express 🚀");
});

// przykładowe API
app.get("/api", (req, res) => {
  res.json({ message: "To jest API" });
});

// uruchomienie serwera
app.listen(port, () => {
  console.log(`Serwer działa na http://localhost:${port}`);
});



require("dotenv").config();

console.log("Port:", process.env.PORT);
console.log("Name:", process.env.NAME);



1312321312