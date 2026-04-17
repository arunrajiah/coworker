CREATE TYPE platform."llm_provider" AS ENUM ('anthropic', 'openai', 'google', 'groq', 'mistral', 'ollama');

ALTER TABLE platform.workspaces
  ADD COLUMN IF NOT EXISTS llm_provider platform."llm_provider",
  ADD COLUMN IF NOT EXISTS llm_model text;
