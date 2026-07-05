-- Increase settings table value column size to TEXT to allow longer redirect scripts URLs lists or serializations.
ALTER TABLE settings MODIFY COLUMN `value` TEXT NULL;
