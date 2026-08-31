CREATE TABLE public.ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_rate_limits TO service_role;
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_rate_limits_caller_created_at_idx ON public.ai_rate_limits (caller, created_at);
CREATE INDEX ai_rate_limits_created_at_idx ON public.ai_rate_limits (created_at);