-- =====================================================================
-- Sistem Presensi Pegawai Aqua Danone
-- Database: MySQL 8.x / MariaDB 10.6+
--
-- Cara pakai:
--   mysql -u root -p < database.sql
--
-- Script ini akan:
--   1. Membuat database `presensi_aqua` (drop kalau sudah ada).
--   2. Membuat tabel employees, sessions, attendance.
--   3. Mengisi data awal: 1 admin + 5 pegawai demo + contoh presensi hari ini.
--   4. Semua password disimpan sebagai hash bcrypt (rounds=10).
--
-- Foto presensi TIDAK disimpan di database. Backend menyimpan file foto
-- ke folder `backend/uploads/attendance/` dan kolom check_in_photo /
-- check_out_photo hanya menyimpan path publiknya, contoh:
--   /uploads/attendance/checkin_2026-04-30_2_a1b2c3d4.png
-- =====================================================================

DROP DATABASE IF EXISTS `presensi_aqua`;
CREATE DATABASE `presensi_aqua`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;
USE `presensi_aqua`;

-- ---------------------------------------------------------------------
-- Tabel: employees (pegawai + akun login)
-- ---------------------------------------------------------------------
CREATE TABLE `employees` (
    `id`            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    `full_name`     VARCHAR(150)   NOT NULL,
    `username`      VARCHAR(64)    NOT NULL,
    `password_hash` VARCHAR(255)   NOT NULL,
    `role`          ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
    `position`      VARCHAR(100)   NOT NULL,
    `department`    VARCHAR(100)   NOT NULL,
    `email`         VARCHAR(150)   NULL,
    `phone`         VARCHAR(40)    NULL,
    `photo_url`     VARCHAR(255)   NULL,
    `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_employees_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabel: sessions (cookie login)
-- ---------------------------------------------------------------------
CREATE TABLE `sessions` (
    `id`         VARCHAR(64)  NOT NULL,
    `user_id`    INT UNSIGNED NOT NULL,
    `expires_at` DATETIME     NOT NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_sessions_user_id` (`user_id`),
    KEY `idx_sessions_expires_at` (`expires_at`),
    CONSTRAINT `fk_sessions_user`
        FOREIGN KEY (`user_id`) REFERENCES `employees` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabel: attendance (presensi harian)
-- ---------------------------------------------------------------------
-- check_in_photo / check_out_photo berisi PATH file (bukan data URL).
-- Contoh nilai: '/uploads/attendance/checkin_2026-04-30_2_a1b2c3d4.png'
-- ---------------------------------------------------------------------
CREATE TABLE `attendance` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `employee_id`     INT UNSIGNED NOT NULL,
    `date`            DATE         NOT NULL,
    `check_in_at`     DATETIME     NULL,
    `check_out_at`    DATETIME     NULL,
    `check_in_photo`  VARCHAR(255) NULL,
    `check_out_photo` VARCHAR(255) NULL,
    `status`          ENUM('hadir', 'terlambat', 'izin') NOT NULL DEFAULT 'hadir',
    `notes`           TEXT         NULL,
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_attendance_emp_date` (`employee_id`, `date`),
    KEY `idx_attendance_date` (`date`),
    CONSTRAINT `fk_attendance_employee`
        FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- DATA AWAL
-- =====================================================================
-- Akun login (username / password):
--   admin / admin123    (HR Manager — admin)
--   budi  / budi123     (pegawai)
--   sari  / sari123     (pegawai)
--   rizky / rizky123    (pegawai)
--   dewi  / dewi123     (pegawai)
--   agus  / agus123     (pegawai)
-- =====================================================================
INSERT INTO `employees`
    (`full_name`, `username`, `password_hash`, `role`, `position`, `department`, `email`, `phone`)
VALUES
    ('Andi Pratama',    'admin', '$2b$10$txjr58ni3oUmDKOktXgbAO7vpv7xYbVh91LJfvnXYaf.zWJOaWScO', 'admin',    'HR Manager',          'Sumber Daya Manusia', 'andi.pratama@aqua.co.id',   '+62 812-1111-1111'),
    ('Budi Santoso',    'budi',  '$2b$10$E9ufOKPrV6zyH2GbZX.SIuSzD8Ud7Xo9VOtJp0cCzZkjqhO390O4u', 'employee', 'Operator Produksi',   'Produksi',            'budi.santoso@aqua.co.id',   '+62 813-2222-2222'),
    ('Sari Wulandari',  'sari',  '$2b$10$P6y4HKxylz9dmaAWk7Mq9.6eW9OrH3g2NN9dyaFVwzvofzeAgeQLS', 'employee', 'Quality Control',     'QA & Quality',        'sari.wulandari@aqua.co.id', '+62 813-3333-3333'),
    ('Rizky Hidayat',   'rizky', '$2b$10$1k3.pWjO4Yi1WS678HxVqu8WFtDUdKINbBv5eEeqZhP224M0G1/9m', 'employee', 'Teknisi Mesin',       'Maintenance',         'rizky.hidayat@aqua.co.id',  '+62 813-4444-4444'),
    ('Dewi Anggraini',  'dewi',  '$2b$10$6zgwaHE8e3CxQnPnHfj2j./87vsvGYiEfh7wYHYabYGRWyDe.jWa2', 'employee', 'Supervisor Logistik', 'Logistik',            'dewi.anggraini@aqua.co.id', '+62 813-5555-5555'),
    ('Agus Setiawan',   'agus',  '$2b$10$nUiYH0iZFEyt76n3LtakS.abzFd9MLyQSlvTf507Mv8Oxnrv8WUGS', 'employee', 'Operator Filling',    'Produksi',            'agus.setiawan@aqua.co.id',  '+62 813-6666-6666');

-- ---------------------------------------------------------------------
-- Contoh presensi hari ini (boleh dihapus jika tidak diperlukan).
-- Foto sengaja dikosongkan; akan terisi otomatis saat pegawai absen
-- dan backend menyimpan file di backend/uploads/attendance/.
-- ---------------------------------------------------------------------
INSERT INTO `attendance`
    (`employee_id`, `date`, `check_in_at`, `check_in_photo`, `status`)
VALUES
    (
        (SELECT `id` FROM `employees` WHERE `username` = 'budi'),
        CURDATE(),
        TIMESTAMP(CURDATE(), '08:05:00'),
        NULL,
        'hadir'
    ),
    (
        (SELECT `id` FROM `employees` WHERE `username` = 'sari'),
        CURDATE(),
        TIMESTAMP(CURDATE(), '08:45:00'),
        NULL,
        'terlambat'
    ),
    (
        (SELECT `id` FROM `employees` WHERE `username` = 'dewi'),
        CURDATE(),
        TIMESTAMP(CURDATE(), '07:55:00'),
        NULL,
        'hadir'
    );
