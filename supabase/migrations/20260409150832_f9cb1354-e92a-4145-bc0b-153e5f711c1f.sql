
-- Allow authenticated users to upload to base-conhecimento
CREATE POLICY "Authenticated users can upload to knowledge base"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'base-conhecimento');

-- Allow authenticated users to delete from base-conhecimento
CREATE POLICY "Authenticated users can delete from knowledge base"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'base-conhecimento');

-- Allow authenticated users to update (upsert) in base-conhecimento
CREATE POLICY "Authenticated users can update knowledge base"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'base-conhecimento');
