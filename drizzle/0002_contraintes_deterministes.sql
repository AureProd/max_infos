ALTER TABLE "social_post" DROP CONSTRAINT "social_post_media_type";--> statement-breakpoint
ALTER TABLE "app_user" DROP CONSTRAINT "app_user_role";--> statement-breakpoint
ALTER TABLE "social_post" ADD CONSTRAINT "social_post_media_type" CHECK ("social_post"."media_type" in ('carousel', 'image', 'post', 'reel'));--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_role" CHECK ("app_user"."role" in ('editor', 'tech'));
