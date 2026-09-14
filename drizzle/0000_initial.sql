CREATE TABLE "app_user" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"role" text DEFAULT 'editor' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_role" CHECK ("app_user"."role" in ('tech', 'editor'))
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"r2_key" text NOT NULL,
	"url" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"alt" text,
	"kind" text DEFAULT 'image' NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_kind" CHECK ("media"."kind" in ('image', 'pdf'))
);
--> statement-breakpoint
CREATE TABLE "article" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "article_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"dek" text,
	"body_md" text DEFAULT '' NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"cover_media_id" integer,
	"reading_minutes" integer DEFAULT 0 NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"substack_url" text,
	"source" text DEFAULT 'site' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_status" CHECK ("article"."status" in ('draft', 'published')),
	CONSTRAINT "article_source" CHECK ("article"."source" in ('site', 'substack_import')),
	CONSTRAINT "article_published_coherent" CHECK (("article"."status" <> 'published') or ("article"."published_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "article_tag" (
	"article_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "article_tag_article_id_tag_id_pk" PRIMARY KEY("article_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tag_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_social_post" (
	"article_id" integer NOT NULL,
	"social_post_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "article_social_post_article_id_social_post_id_pk" PRIMARY KEY("article_id","social_post_id")
);
--> statement-breakpoint
CREATE TABLE "social_post" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "social_post_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"network" text NOT NULL,
	"external_id" text,
	"url" text,
	"shortcode" text,
	"media_type" text,
	"caption" text,
	"thumbnail_url" text,
	"permalink" text,
	"posted_at" timestamp with time zone,
	"source" text DEFAULT 'manual' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_post_network" CHECK ("social_post"."network" in ('instagram', 'linkedin')),
	CONSTRAINT "social_post_source" CHECK ("social_post"."source" in ('api', 'manual')),
	CONSTRAINT "social_post_media_type" CHECK ("social_post"."media_type" in ('reel', 'carousel', 'image', 'post'))
);
--> statement-breakpoint
CREATE TABLE "secret" (
	"key" text PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"scope" text DEFAULT 'public' NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "setting_scope" CHECK ("setting"."scope" in ('public', 'tech'))
);
--> statement-breakpoint
CREATE TABLE "article_view" (
	"article_id" integer NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "article_view_article_id_day_pk" PRIMARY KEY("article_id","day")
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_app_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tag" ADD CONSTRAINT "article_tag_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tag" ADD CONSTRAINT "article_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_social_post" ADD CONSTRAINT "article_social_post_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_social_post" ADD CONSTRAINT "article_social_post_social_post_id_social_post_id_fk" FOREIGN KEY ("social_post_id") REFERENCES "public"."social_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting" ADD CONSTRAINT "setting_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_view" ADD CONSTRAINT "article_view_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_app_user_email" ON "app_user" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_media_r2_key" ON "media" USING btree ("r2_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_article_slug" ON "article" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ix_article_published" ON "article" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ix_article_tag_tag" ON "article_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tag_slug" ON "tag" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ix_article_social_post_social" ON "article_social_post" USING btree ("social_post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_social_post_network_external_id" ON "social_post" USING btree ("network","external_id");--> statement-breakpoint
CREATE INDEX "ix_social_post_posted" ON "social_post" USING btree ("network","posted_at" DESC NULLS LAST);--> statement-breakpoint
-- Ajouté à la main après génération, et à conserver lors de toute
-- régénération de cette migration.
--
-- Drizzle pose `$onUpdate` côté APPLICATIF : un UPDATE passé à la main dans
-- psql, ou par un script d'import, ne toucherait pas `updated_at`. Comme le
-- projet prévoit un import/export et une migration de contenu en masse, on
-- double la garantie côté SQL.
CREATE EXTENSION IF NOT EXISTS moddatetime;--> statement-breakpoint
CREATE TRIGGER app_user_updated_at BEFORE UPDATE ON "app_user"
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);--> statement-breakpoint
CREATE TRIGGER media_updated_at BEFORE UPDATE ON "media"
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);--> statement-breakpoint
CREATE TRIGGER article_updated_at BEFORE UPDATE ON "article"
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);--> statement-breakpoint
CREATE TRIGGER tag_updated_at BEFORE UPDATE ON "tag"
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);--> statement-breakpoint
CREATE TRIGGER social_post_updated_at BEFORE UPDATE ON "social_post"
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);--> statement-breakpoint
CREATE TRIGGER setting_updated_at BEFORE UPDATE ON "setting"
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);--> statement-breakpoint
CREATE TRIGGER secret_updated_at BEFORE UPDATE ON "secret"
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
