const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const passport = require("passport");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: ["https://goodnews1010.github.io", "http://127.0.0.1:5500"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(passport.initialize());
app.use('/api/auth/google', require('./routes/google'));
app.use('/api/auth/github', require('./routes/github'));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/documents", require("./routes/documents"));
app.use('/api/password', require('./routes/reset'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/announcement', require('./routes/announcement'));

app.get("/", (req, res) => {
  res.json({ message: "Euscribe API is running 🚀" });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });