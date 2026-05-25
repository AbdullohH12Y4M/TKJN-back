import { Router } from "express";
import { findOne, query } from "../db.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import {
  AttendanceRow,
  EmployeeBrief,
  shapeAttendance,
  todayJakarta,
} from "../lib/attendance-helpers.js";

const router = Router();

interface JoinedRow extends AttendanceRow {
  full_name: string;
  position: string;
  department: string;
}

router.get(
  "/dashboard/summary",
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    const today = todayJakarta();

    const totalRow = await findOne<{ value: number }>(
      "SELECT COUNT(*) AS value FROM employees WHERE role = 'employee'",
    );
    const totalEmployees = Number(totalRow?.value ?? 0);

    const todays = await query<AttendanceRow>(
      "SELECT * FROM attendance WHERE date = ?",
      [today],
    );

    const presentToday = todays.rows.filter(
      (r) => r.status === "hadir" && r.check_in_at,
    ).length;
    const lateToday = todays.rows.filter((r) => r.status === "terlambat").length;
    const onLeaveToday = todays.rows.filter((r) => r.status === "izin").length;
    const accountedFor = todays.rows.length;
    const absentToday = Math.max(0, totalEmployees - accountedFor);

    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const weekRow = await findOne<{ value: number }>(
      "SELECT COUNT(*) AS value FROM attendance WHERE date >= ?",
      [weekStartStr],
    );
    const totalThisWeek = Number(weekRow?.value ?? 0);

    res.json({
      totalEmployees,
      presentToday,
      lateToday,
      absentToday,
      onLeaveToday,
      totalThisWeek,
    });
  },
);

router.get(
  "/dashboard/recent",
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    const { rows } = await query<JoinedRow>(
      `SELECT a.*, e.full_name, e.position, e.department
       FROM attendance a
       INNER JOIN employees e ON e.id = a.employee_id
       ORDER BY a.created_at DESC
       LIMIT 10`,
    );
    res.json(
      rows.map((r) => {
        const { full_name, position, department, ...rest } = r;
        const emp: EmployeeBrief = { full_name, position, department };
        return shapeAttendance(rest as AttendanceRow, emp);
      }),
    );
  },
);

export default router;
