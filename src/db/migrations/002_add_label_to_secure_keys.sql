-- Migración: Añadir columna label a secure_keys
-- Fecha: 2026-02-01
-- Descripción: La columna label permite identificar el tipo de clave segura

ALTER TABLE secure_keys ADD COLUMN label TEXT DEFAULT '';
