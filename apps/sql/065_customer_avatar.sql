-- customers 테이블에 avatar_url 컬럼 추가
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Supabase Storage: avatars 버킷 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS 기존 정책 제거 후 재생성
DO $$
BEGIN
  DROP POLICY IF EXISTS "avatars_upload_own" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
END$$;

CREATE POLICY "avatars_upload_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
