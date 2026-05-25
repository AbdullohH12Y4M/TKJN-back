import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { findOne, query } from "../db.js";

const SESSION_COOKIE = "presensi_sid";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 hari

export interface Employee {
  id: number;
  full_name: string;
  username: string;
  password_hash: string;
  role: "admin" | "employee";
  position: string;
  department: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  created_at: Date;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: number): Promise<string> {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    [id, userId, expiresAt],
  );
  return id;
}

export async function destroySession(id: string): Promise<void> {
  await query("DELETE FROM sessions WHERE id = ?", [id]);
}

export async function getUserBySessionId(
  id: string,
): Promise<Employee | null> {
  return findOne<Employee>(
    `SELECT e.* FROM sessions s
     INNER JOIN employees e ON e.id = s.user_id
     WHERE s.id = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [id],
  );
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionCookie(req: Request): string | null {
  const raw = (req as unknown as { cookies?: Record<string, string> }).cookies;
  return raw?.[SESSION_COOKIE] ?? null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Employee;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
  req.user = user;
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Hanya admin yang diizinkan" });
    return;
  }
  next();
}

export function publicEmployee(emp: Employee) {
  return {
    id: emp.id,
    fullName: emp.full_name,
    username: emp.username,
    role: emp.role,
    position: emp.position,
    department: emp.department,
    email: emp.email,
    phone: emp.phone,
    photoUrl: emp.photo_url,
    createdAt: emp.created_at,
  };
}

export function authPayload(emp: Employee) {
  return {
    id: emp.id,
    username: emp.username,
    role: emp.role,
    fullName: emp.full_name,
    employeeId: emp.id,
    position: emp.position,
    department: emp.department,
    photoUrl: emp.photo_url,
  };
}
