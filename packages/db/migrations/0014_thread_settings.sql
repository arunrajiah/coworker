CREATE TABLE IF NOT EXISTS "tenant"."thread_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"thread_id" text NOT NULL,
	"llm_provider" "llm_provider",
	"llm_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "thread_settings_thread_idx" ON "tenant"."thread_settings" USING btree ("workspace_id","thread_id");