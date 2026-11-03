-- Allow offline/dummy trip members that are not linked to a registered User.
-- Existing registered members remain linked; userId is nullable for dummy entries.
ALTER TABLE `TripMember`
  MODIFY `userId` VARCHAR(191) NULL,
  ADD COLUMN `isDummy` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `displayName` VARCHAR(100) NULL,
  ADD COLUMN `email` VARCHAR(255) NULL,
  ADD COLUMN `phone` VARCHAR(50) NULL;
