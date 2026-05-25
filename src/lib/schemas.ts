import { z } from "zod";

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const CreateEmployeeSchema = z.object({
  fullName: z.string().min(1),
  username: z.string().min(3).max(64),
  password: z.string().min(4),
  role: z.enum(["admin", "employee"]).optional(),
  position: z.string().min(1),
  department: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
});

export const UpdateEmployeeSchema = z.object({
  fullName: z.string().min(1).optional(),
  username: z.string().min(3).max(64).optional(),
  password: z.string().optional(),
  role: z.enum(["admin", "employee"]).optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
});

export const CheckInSchema = z.object({
  photo: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export const CheckOutSchema = z.object({
  photo: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export const ListAttendanceQuerySchema = z.object({
  date: z.string().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
});
