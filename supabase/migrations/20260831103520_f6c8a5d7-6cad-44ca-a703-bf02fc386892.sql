DROP POLICY IF EXISTS "Anyone can delete ranking snapshots" ON public.ranking_snapshots;
DROP POLICY IF EXISTS "Anyone can update ranking snapshots" ON public.ranking_snapshots;
DROP POLICY IF EXISTS "Anyone can add ranking snapshots" ON public.ranking_snapshots;
REVOKE INSERT, UPDATE, DELETE ON public.ranking_snapshots FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ranking_snapshots FROM authenticated;
GRANT ALL ON public.ranking_snapshots TO service_role;