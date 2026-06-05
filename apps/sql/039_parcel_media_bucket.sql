-- parcel-media Storage 버킷 생성
-- 입고 사진/영상을 저장하는 Supabase Storage 버킷

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'parcel-media',
  'parcel-media',
  false,                          -- 비공개 (서비스 역할 키로만 접근)
  10485760,                       -- 10MB 파일 크기 제한
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- 서비스 역할은 RLS 우회하므로 별도 정책 불필요
-- 고객 공개 URL은 storage_url 컬럼으로 getPublicUrl() 사용
