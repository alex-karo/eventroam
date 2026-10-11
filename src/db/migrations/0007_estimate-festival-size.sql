-- Preserve catalog data, indexes, triggers and immutable history.
ALTER TABLE `editions` RENAME COLUMN `capacity_estimate` TO `size_estimate`;
