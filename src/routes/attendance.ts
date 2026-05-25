import { Router } from "express";
import { findOne, query } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import {
  approxBytes,
  AttendanceRow,
  EmployeeBrief,
  shapeAttendance,
  statusFromCheckIn,
  todayJakarta,
} from "../lib/attendance-helpers.js";
import {
  CheckInSchema,
  CheckOutSchema,
  ListAttendanceQuerySchema,
} from "../lib/schemas.js";
import { deletePhotoIfExists, saveAttendancePhoto } from "../lib/storage.js";

const router = Router();

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB

interface JoinedRow extends AttendanceRow {
  full_name: string;
  position: string;
  department: string;
}

function splitJoined(r: JoinedRow): { row: AttendanceRow; emp: EmployeeBrief } {
  const { full_name, position, department, ...rest } = r;
  return {
    row: rest as AttendanceRow,
    emp: { full_name, position, department },
  };
}

router.get("/attendance", requireAuth, async (req, res) => {
  const parsed = ListAttendanceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.date) {
    conditions.push("a.date = ?");
    values.push(parsed.data.date);
  }
  if (parsed.data.employeeId) {
    conditions.push("a.employee_id = ?");
    values.push(parsed.data.employeeId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query<JoinedRow>(
    `SELECT a.*, e.full_name, e.position, e.department
     FROM attendance a
     INNER JOIN employees e ON e.id = a.employee_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT 500`,
    values,
  );
  res.json(rows.map((r) => {
    const { row, emp } = splitJoined(r);
    return shapeAttendance(row, emp);
  }));
});

router.get("/attendance/today", requireAuth, async (req, res) => {
  const user = req.user!;
  const today = todayJakarta();
  const row = await findOne<AttendanceRow>(
    `SELECT * FROM attendance
     WHERE employee_id = ? AND date = ?
     LIMIT 1`,
    [user.id, today],
  );
  if (!row) {
    res.json({ hasRecord: false, record: null });
    return;
  }
  res.json({
    hasRecord: true,
    record: shapeAttendance(row, {
      full_name: user.full_name,
      position: user.position,
      department: user.department,
    }),
  });
});

router.post("/attendance/check-in", requireAuth, async (req, res) => {
  const parsed = CheckInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.photo.startsWith("data:image/")) {
    res.status(400).json({ error: "Foto tidak valid" });
    return;
  }
  if (approxBytes(parsed.data.photo) > MAX_PHOTO_BYTES) {
    res.status(400).json({ error: "Ukuran foto melebihi 2MB. Coba ambil ulang." });
    return;
  }
  const user = req.user!;
  const today = todayJakarta();
  const now = new Date();

  const existing = await findOne<AttendanceRow>(
    "SELECT * FROM attendance WHERE employee_id = ? AND date = ? LIMIT 1",
    [user.id, today],
  );

  if (existing && existing.check_in_at) {
    res.status(400).json({ error: "Anda sudah absen masuk hari ini" });
    return;
  }

  // Simpan foto sebagai file di folder uploads/attendance
  let photoUrl: string;
  try {
    const saved = await saveAttendancePhoto(parsed.data.photo, "checkin", user.id, today);
    photoUrl = saved.publicUrl;
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const status = statusFromCheckIn(now);
  let recordId: number;

  if (existing) {
    await query(
      `UPDATE attendance
         SET check_in_at = ?, check_in_photo = ?, status = ?, notes = COALESCE(?, notes)
       WHERE id = ?`,
      [now, photoUrl, status, parsed.data.notes ?? null, existing.id],
    );
    recordId = existing.id;
  } else {
    const result = await query(
      `INSERT INTO attendance
         (employee_id, date, check_in_at, check_in_photo, status, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, today, now, photoUrl, status, parsed.data.notes ?? null],
    );
    recordId = result.insertId;
  }

  const row = await findOne<AttendanceRow>(
    "SELECT * FROM attendance WHERE id = ? LIMIT 1",
    [recordId],
  );
  if (!row) {
    res.status(500).json({ error: "Gagal memuat record presensi" });
    return;
  }

  res.status(201).json(
    shapeAttendance(row, {
      full_name: user.full_name,
      position: user.position,
      department: user.department,
    }),
  );
});

router.post("/attendance/check-out", requireAuth, async (req, res) => {
  const parsed = CheckOutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.photo.startsWith("data:image/")) {
    res.status(400).json({ error: "Foto tidak valid" });
    return;
  }
  if (approxBytes(parsed.data.photo) > MAX_PHOTO_BYTES) {
    res.status(400).json({ error: "Ukuran foto melebihi 2MB. Coba ambil ulang." });
    return;
  }
  const user = req.user!;
  const today = todayJakarta();

  const existing = await findOne<AttendanceRow>(
    "SELECT * FROM attendance WHERE employee_id = ? AND date = ? LIMIT 1",
    [user.id, today],
  );

  if (!existing || !existing.check_in_at) {
    res.status(400).json({ error: "Anda belum absen masuk hari ini" });
    return;
  }
  if (existing.check_out_at) {
    res.status(400).json({ error: "Anda sudah absen pulang hari ini" });
    return;
  }

  // Hapus foto check-out lama (kalau ada) lalu simpan yang baru
  await deletePhotoIfExists(existing.check_out_photo);

  let photoUrl: string;
  try {
    const saved = await saveAttendancePhoto(parsed.data.photo, "checkout", user.id, today);
    photoUrl = saved.publicUrl;
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  await query(
    `UPDATE attendance
       SET check_out_at = NOW(), check_out_photo = ?, notes = COALESCE(?, notes)
     WHERE id = ?`,
    [photoUrl, parsed.data.notes ?? null, existing.id],
  );

  const row = await findOne<AttendanceRow>(
    "SELECT * FROM attendance WHERE id = ? LIMIT 1",
    [existing.id],
  );
  if (!row) {
    res.status(500).json({ error: "Gagal memuat record presensi" });
    return;
  }

  res.json(
    shapeAttendance(row, {
      full_name: user.full_name,
      position: user.position,
      department: user.department,
    }),
  );
});

export default router;
