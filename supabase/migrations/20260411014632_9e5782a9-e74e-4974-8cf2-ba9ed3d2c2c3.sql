
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding text,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_specialty_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  document_title text,
  document_source text
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    (1 - (kc.embedding <=> query_embedding::vector))::float AS similarity,
    kd.title AS document_title,
    kd.source AS document_source
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kd.is_active = true
    AND (1 - (kc.embedding <=> query_embedding::vector))::float > match_threshold
    AND (filter_specialty_id IS NULL OR kd.specialty_id IS NULL OR kd.specialty_id = filter_specialty_id)
  ORDER BY kc.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;
