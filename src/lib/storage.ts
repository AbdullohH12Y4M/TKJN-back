import { mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

// backend/src/lib/storage.ts -> backend/uploads/
export const UPLOAD_ROOT = join(__dirname, "..", "..", "uploads");
export const ATTENDANCE_DIR = join(UPLOAD_ROOT, "attendance");
export const PUBLIC_PATH_PREFIX = "/uploads";

export async function ensureUploadDirs(): Promise<void> {
  if (!existsSync(ATTENDANCE_DIR)) {
    await mkdir(ATTENDANCE_DIR, { recursive: true });
  }
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface SavedPhoto {
  filename: string;   // contoh: "checkin_2026-04-30_5_a1b2c3d4.png"
  publicUrl: string;  // contoh: "/uploads/attendance/checkin_2026-04-30_5_a1b2c3d4.png"
  bytes: number;
}

/**
 * Simpan foto dari data URL (data:image/...;base64,...) ke folder uploads/attendance.
 * Mengembalikan path publik yang akan disimpan ke kolom check_in_photo / check_out_photo.
 */
export async function saveAttendancePhoto(
  dataUrl: string,
  prefix: "checkin" | "checkout",
  employeeId: number,
  date: string,
): Promise<SavedPhoto> {
  await ensureUploadDirs();

  const match = /^data:(image\/[a-zA-Z]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Format foto tidak valid");
  }
  const mime = match[1].toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) {
    throw new Error("Tipe foto tidak didukung (gunakan JPG/PNG/WebP)");
  }
  const buffer = Buffer.from(match[2], "base64");
  const random = randomBytes(6).toString("hex");
  const filename = `${prefix}_${date}_${employeeId}_${random}.${ext}`;
  const fullPath = join(ATTENDANCE_DIR, filename);
  await writeFile(fullPath, buffer);
  return {
    filename,
    publicUrl: `${PUBLIC_PATH_PREFIX}/attendance/${filename}`,
    bytes: buffer.byteLength,
  };
}

/**
 * Hapus foto dari disk. Aman dipanggil walau file sudah tidak ada.
 */
export async function deletePhotoIfExists(publicUrl: string | null): Promise<void> {
  if (!publicUrl) return;
  if (!publicUrl.startsWith(`${PUBLIC_PATH_PREFIX}/attendance/`)) return;
  const filename = publicUrl.substring(`${PUBLIC_PATH_PREFIX}/attendance/`.length);
  const fullPath = join(ATTENDANCE_DIR, filename);
  try {
    await unlink(fullPath);
  } catch {
    // file mungkin sudah dihapus, abaikan
  }
}
