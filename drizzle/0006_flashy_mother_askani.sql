ALTER TABLE "app_user" DROP CONSTRAINT "app_user_role";--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_role" CHECK ("app_user"."role" in ('developer', 'editor', 'tech'));--> statement-breakpoint
-- Renaming the role, in two deployments.
--
-- Step one, here: the constraint accepts BOTH names, and the existing rows
-- take the new one. The old container is still serving while this runs, and
-- it writes 'tech' — so 'tech' must remain legal, and the application reads
-- it as 'developer' (shared/utils/roles.ts, asRole).
--
-- Step two, a LATER migration, once no container writes 'tech' any more:
-- narrow the constraint back to ('developer', 'editor').
UPDATE "app_user" SET "role" = 'developer' WHERE "role" = 'tech';
