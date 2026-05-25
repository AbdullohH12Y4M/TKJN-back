import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routes/auth.js";
import employeesRouter from "./routes/employees.js";
import attendanceRouter from "./routes/attendance.js";
import dashboardRouter from "./routes/dashboard.js";
import { ensureUploadDirs, UPLOAD_ROOT } from "./lib/storage.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

// Sajikan file foto presensi sebagai static files.
// Path publik: http://localhost:3001/uploads/attendance/<filename>
app.use(
  "/uploads",
  express.static(UPLOAD_ROOT, {
    maxAge: "1d",
    fallthrough: false,
  }),
);

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", authRouter);
app.use("/api", employeesRouter);
app.use("/api", attendanceRouter);
app.use("/api", dashboardRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Terjadi kesalahan pada server" });
});

const port = Number(process.env.PORT ?? 3001);
ensureUploadDirs()
  .then(() => {
    app.listen(port, () => {
      console.log(`[backend] siap di http://localhost:${port}`);
      console.log(`[backend] foto presensi: http://localhost:${port}/uploads/attendance/`);
    });
  })
  .catch((err) => {
    console.error("Gagal menyiapkan folder uploads:", err);
    process.exit(1);
  });
