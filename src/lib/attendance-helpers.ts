export interface AttendanceRow {
  id: number;
  employee_id: number;
  date: string | Date;
  check_in_at: Date | null;
  check_out_at: Date | null;
  check_in_photo: string | null;
  check_out_photo: string | null;
  status: "hadir" | "terlambat" | "izin";
  notes: string | null;
  created_at: Date;
}

export interface EmployeeBrief {
  full_name: string;
  position: string;
  department: string;
}

export function todayJakarta(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export function jakartaHourMinute(d: Date): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

// Terlambat jika absen masuk lewat jam 08:30 WIB
export function statusFromCheckIn(d: Date): "hadir" | "terlambat" {
  const { hour, minute } = jakartaHourMinute(d);
  const totalMinutes = hour * 60 + minute;
  return totalMinutes > 8 * 60 + 30 ? "terlambat" : "hadir";
}

export function shapeAttendance(row: AttendanceRow, emp: EmployeeBrief) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: emp.full_name,
    position: emp.position,
    department: emp.department,
    date:
      typeof row.date === "string"
        ? row.date
        : new Date(row.date).toISOString().slice(0, 10),
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    checkInPhoto: row.check_in_photo,
    checkOutPhoto: row.check_out_photo,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function approxBytes(dataUrl: string): number {
  const idx = dataUrl.indexOf(",");
  if (idx === -1) return dataUrl.length;
  const b64 = dataUrl.slice(idx + 1);
  return Math.floor((b64.length * 3) / 4);
}
