DO $$ BEGIN
  CREATE TYPE "public"."llm_provider" AS ENUM('anthropic', 'openai', 'google', 'groq', 'mistral', 'ollama', 'xai', 'cohere', 'deepseek', 'together', 'openrouter');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."git_provider" AS ENUM('github', 'gitlab', 'bitbucket');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."task_domain" AS ENUM('general', 'development', 'qa', 'marketing', 'finance', 'design', 'operations', 'hr', 'legal', 'sales');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."spec_status" AS ENUM('draft', 'active', 'deprecated');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."spec_type" AS ENUM('requirement', 'blueprint', 'feedback');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TYPE "public"."template_type" ADD VALUE IF NOT EXISTS 'creator' BEFORE 'general';--> statement-breakpoint
ALTER TYPE "public"."template_type" ADD VALUE IF NOT EXISTS 'real_estate' BEFORE 'general';--> statement-breakpoint
ALTER TYPE "public"."message_channel" ADD VALUE IF NOT EXISTS 'slack';--> statement-breakpoint
ALTER TYPE "public"."autopilot_trigger" ADD VALUE IF NOT EXISTS 'git_issue_opened';--> statement-breakpoint
ALTER TYPE "public"."autopilot_trigger" ADD VALUE IF NOT EXISTS 'git_pr_opened';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_member_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."telegram_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"telegram_username" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_connections_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."slack_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"bot_token" text NOT NULL,
	"app_token" text,
	"team_name" text,
	"team_id" text,
	"bot_user_id" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."whatsapp_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_sid" text NOT NULL,
	"auth_token" text NOT NULL,
	"from_number" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."git_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "git_provider" NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"access_token" text NOT NULL,
	"webhook_secret" text NOT NULL,
	"connected_by" uuid NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."vercel_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"team_id" text,
	"team_slug" text,
	"team_name" text,
	"project_id" text NOT NULL,
	"project_name" text NOT NULL,
	"framework" text,
	"git_connection_id" uuid,
	"connected_by" uuid NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."linear_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"team_id" text NOT NULL,
	"team_name" text NOT NULL,
	"api_key" text NOT NULL,
	"connected_by" uuid NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."notion_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"notion_workspace_id" text NOT NULL,
	"notion_workspace_name" text NOT NULL,
	"access_token" text NOT NULL,
	"bot_id" text NOT NULL,
	"connected_by" uuid NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."gcal_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"google_email" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"refresh_token" text NOT NULL,
	"connected_by" uuid NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant"."specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"type" "spec_type" DEFAULT 'requirement' NOT NULL,
	"status" "spec_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant"."budget_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"month" text NOT NULL,
	"threshold_pct" integer NOT NULL,
	"spend_usd" numeric(10, 4) NOT NULL,
	"budget_usd" numeric(10, 4) NOT NULL,
	"fired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_alerts_workspace_id_month_threshold_pct_unique" UNIQUE("workspace_id","month","threshold_pct")
);
--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ALTER COLUMN "status" SET DEFAULT 'todo';--> statement-breakpoint
ALTER TABLE "platform"."workspaces" ADD COLUMN IF NOT EXISTS "llm_provider" "llm_provider";--> statement-breakpoint
ALTER TABLE "platform"."workspaces" ADD COLUMN IF NOT EXISTS "llm_model" text;--> statement-breakpoint
ALTER TABLE "platform"."workspaces" ADD COLUMN IF NOT EXISTS "monthly_budget_usd" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "platform"."workspaces" ADD COLUMN IF NOT EXISTS "budget_alert_threshold" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ADD COLUMN IF NOT EXISTS "domain" "task_domain" DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ADD COLUMN IF NOT EXISTS "queued_for_agent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ADD COLUMN IF NOT EXISTS "agent_notes" text;--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ADD COLUMN IF NOT EXISTS "spec_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ADD COLUMN IF NOT EXISTS "acceptance_criteria" text;--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ADD COLUMN IF NOT EXISTS "git_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ADD COLUMN IF NOT EXISTS "git_issue_number" integer;--> statement-breakpoint
ALTER TABLE "tenant"."messages" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "tenant"."agent_runs" ADD COLUMN IF NOT EXISTS "prompt_tokens" integer;--> statement-breakpoint
ALTER TABLE "tenant"."agent_runs" ADD COLUMN IF NOT EXISTS "completion_tokens" integer;--> statement-breakpoint
ALTER TABLE "tenant"."agent_runs" ADD COLUMN IF NOT EXISTS "cost_usd" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "tenant"."files" ADD COLUMN IF NOT EXISTS "extraction_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant"."files" ADD COLUMN IF NOT EXISTS "extracted_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "platform"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "platform"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."telegram_connections" ADD CONSTRAINT "telegram_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "platform"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."telegram_connections" ADD CONSTRAINT "telegram_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."slack_connections" ADD CONSTRAINT "slack_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "platform"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."slack_connections" ADD CONSTRAINT "slack_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "platform"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."git_connections" ADD CONSTRAINT "git_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "platform"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."git_connections" ADD CONSTRAINT "git_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "platform"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."linear_connections" ADD CONSTRAINT "linear_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "platform"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."linear_connections" ADD CONSTRAINT "linear_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "platform"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."notion_connections" ADD CONSTRAINT "notion_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "platform"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."notion_connections" ADD CONSTRAINT "notion_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "platform"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."gcal_connections" ADD CONSTRAINT "gcal_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "platform"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform"."gcal_connections" ADD CONSTRAINT "gcal_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "platform"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_invitations_token_idx" ON "platform"."workspace_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_invitations_workspace_idx" ON "platform"."workspace_invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vercel_connections_workspace_idx" ON "platform"."vercel_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "linear_connections_workspace_idx" ON "platform"."linear_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notion_connections_workspace_idx" ON "platform"."notion_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gcal_connections_workspace_idx" ON "platform"."gcal_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "specs_workspace_idx" ON "tenant"."specs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "specs_type_idx" ON "tenant"."specs" USING btree ("workspace_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_alerts_workspace_month_idx" ON "tenant"."budget_alerts" USING btree ("workspace_id","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_domain_idx" ON "tenant"."tasks" USING btree ("workspace_id","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_git_idx" ON "tenant"."tasks" USING btree ("workspace_id","git_connection_id");--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."task_status";--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled');--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ALTER COLUMN "status" SET DATA TYPE "public"."task_status"
  USING (CASE WHEN "status" IN ('backlog','todo','in_progress','review','done','cancelled') THEN "status" ELSE 'todo' END)::"public"."task_status";--> statement-breakpoint
ALTER TABLE "tenant"."tasks" ALTER COLUMN "status" SET DEFAULT 'todo';