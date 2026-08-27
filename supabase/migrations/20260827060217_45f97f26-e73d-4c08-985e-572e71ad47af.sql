CREATE TABLE public.ranking_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  points JSONB NOT NULL DEFAULT '{}'::jsonb,
  ranks JSONB NOT NULL DEFAULT '{}'::jsonb,
  rosters JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'daily',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ranking_snapshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ranking_snapshots TO authenticated;
GRANT ALL ON public.ranking_snapshots TO service_role;

ALTER TABLE public.ranking_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ranking snapshots are readable by everyone"
  ON public.ranking_snapshots FOR SELECT USING (true);
CREATE POLICY "Anyone can add ranking snapshots"
  ON public.ranking_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ranking snapshots"
  ON public.ranking_snapshots FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete ranking snapshots"
  ON public.ranking_snapshots FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ranking_snapshots_updated_at
BEFORE UPDATE ON public.ranking_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ranking_snapshots_date ON public.ranking_snapshots (snapshot_date);