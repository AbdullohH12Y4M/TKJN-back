import { Router } from "express";
import { findOne, query } from "../db.js";
import {
  Employee,
  hashPassword,
  publicEmployee,
  requireAdmin,
  requireAuth,
} from "../lib/auth.js";
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
} from "../lib/schemas.js";

const router = Router();

router.get("/employees", requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await query<Employee>(
    "SELECT * FROM employees ORDER BY full_name ASC",
  );
  res.json(rows.map(publicEmployee));
});

router.post("/employees", requireAuth, requireAdmin, async (req, res) => {
  const parsed = CreateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const exists = await findOne<{ id: number }>(
    "SELECT id FROM employees WHERE username = ? LIMIT 1",
    [data.username],
  );
  if (exists) {
    res.status(400).json({ error: "Username sudah digunakan" });
    return;
  }
  const passwordHash = await hashPassword(data.password);
  const result = await query(
    `INSERT INTO employees
       (full_name, username, password_hash, role, position, department, email, phone, photo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.fullName,
      data.username,
      passwordHash,
      data.role ?? "employee",
      data.position,
      data.department,
      data.email ?? null,
      data.phone ?? null,
      data.photoUrl ?? null,
    ],
  );
  const created = await findOne<Employee>(
    "SELECT * FROM employees WHERE id = ? LIMIT 1",
    [result.insertId],
  );
  if (!created) {
    res.status(500).json({ error: "Gagal membuat pegawai" });
    return;
  }
  res.status(201).json(publicEmployee(created));
});

router.get("/employees/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID tidak valid" });
    return;
  }
  const emp = await findOne<Employee>(
    "SELECT * FROM employees WHERE id = ? LIMIT 1",
    [id],
  );
  if (!emp) {
    res.status(404).json({ error: "Pegawai tidak ditemukan" });
    return;
  }
  res.json(publicEmployee(emp));
});

router.patch("/employees/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID tidak valid" });
    return;
  }
  const parsed = UpdateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;

  const sets: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    full_name: data.fullName,
    username: data.username,
    role: data.role,
    position: data.position,
    department: data.department,
    email: data.email,
    phone: data.phone,
    photo_url: data.photoUrl,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      values.push(val);
      sets.push(`${col} = ?`);
    }
  }
  if (data.password !== undefined && data.password.length > 0) {
    values.push(await hashPassword(data.password));
    sets.push(`password_hash = ?`);
  }
  if (sets.length === 0) {
    res.status(400).json({ error: "Tidak ada perubahan" });
    return;
  }
  values.push(id);
  const result = await query(
    `UPDATE employees SET ${sets.join(", ")}, updated_at = NOW() WHERE id = ?`,
    values,
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: "Pegawai tidak ditemukan" });
    return;
  }
  const updated = await findOne<Employee>(
    "SELECT * FROM employees WHERE id = ? LIMIT 1",
    [id],
  );
  if (!updated) {
    res.status(404).json({ error: "Pegawai tidak ditemukan" });
    return;
  }
  res.json(publicEmployee(updated));
});

router.delete("/employees/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID tidak valid" });
    return;
  }
  const result = await query("DELETE FROM employees WHERE id = ?", [id]);
  if (result.rowCount === 0) {
    res.status(404).json({ error: "Pegawai tidak ditemukan" });
    return;
  }
  res.status(204).send();
});

export default router;
