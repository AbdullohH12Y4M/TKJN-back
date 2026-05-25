import { Router } from "express";
import { findOne } from "../db.js";
import {
  authPayload,
  clearSessionCookie,
  createSession,
  destroySession,
  Employee,
  getSessionCookie,
  getUserBySessionId,
  setSessionCookie,
  verifyPassword,
} from "../lib/auth.js";
import { LoginSchema } from "../lib/schemas.js";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username dan password wajib diisi" });
    return;
  }
  const { username, password } = parsed.data;
  const user = await findOne<Employee>(
    "SELECT * FROM employees WHERE username = ? LIMIT 1",
    [username],
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    res.status(401).json({ error: "Username atau password salah" });
    return;
  }
  const sid = await createSession(user.id);
  setSessionCookie(res, sid);
  res.json(authPayload(user));
});

router.post("/auth/logout", async (req, res) => {
  const sid = getSessionCookie(req);
  if (sid) await destroySession(sid);
  clearSessionCookie(res);
  res.status(204).send();
});

router.get("/auth/me", async (req, res) => {
  const sid = getSessionCookie(req);
  if (!sid) {
    res.status(401).json({ error: "Belum login" });
    return;
  }
  const user = await getUserBySessionId(sid);
  if (!user) {
    res.status(401).json({ error: "Sesi tidak valid" });
    return;
  }
  res.json(authPayload(user));
});

export default router;
