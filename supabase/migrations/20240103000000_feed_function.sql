CREATE OR REPLACE FUNCTION get_feed_items(
  p_user_id   UUID,
  p_offset    INTEGER DEFAULT 0,
  p_limit     INTEGER DEFAULT 10
)
RETURNS TABLE (
  freelancer_id         UUID,
  user_id               UUID,
  full_name             TEXT,
  avatar_url            TEXT,
  city                  TEXT,
  state                 TEXT,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  bio                   TEXT,
  hourly_rate           NUMERIC,
  availability          TEXT,
  service_categories    TEXT[],
  verification_status   TEXT,
  portfolio_media_url   TEXT,
  portfolio_media_type  TEXT,
  portfolio_title       TEXT,
  portfolio_description TEXT,
  distance_miles        DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lat           DOUBLE PRECISION;
  v_lng           DOUBLE PRECISION;
  v_radius        INTEGER;
  v_service_prefs TEXT[];
BEGIN
  SELECT u.lat, u.lng, u.radius_preference_miles, bp.service_preferences
    INTO v_lat, v_lng, v_radius, v_service_prefs
    FROM public.users u
    LEFT JOIN public.business_profiles bp ON bp.user_id = u.id
   WHERE u.id = p_user_id;

  RETURN QUERY
  WITH best_media AS (
    SELECT DISTINCT ON (fp.id)
      fp.id        AS fp_id,
      pi.media_url,
      pi.media_type,
      pi.title,
      pi.description
    FROM public.freelancer_profiles fp
    LEFT JOIN public.portfolio_items pi ON pi.freelancer_id = fp.id
    ORDER BY
      fp.id,
      CASE pi.media_type WHEN 'video' THEN 0 ELSE 1 END,
      pi.created_at DESC
  )
  SELECT
    fp.id                          AS freelancer_id,
    u.id                           AS user_id,
    u.full_name,
    u.avatar_url,
    u.city,
    u.state,
    u.lat,
    u.lng,
    fp.bio,
    fp.hourly_rate,
    fp.availability::TEXT,
    fp.service_categories,
    fp.verification_status::TEXT,
    bm.media_url                   AS portfolio_media_url,
    bm.media_type                  AS portfolio_media_type,
    bm.title                       AS portfolio_title,
    bm.description                 AS portfolio_description,
    CASE
      WHEN v_lat IS NOT NULL
       AND v_lng IS NOT NULL
       AND u.lat  IS NOT NULL
       AND u.lng  IS NOT NULL
      THEN ST_Distance(
             ST_MakePoint(v_lng, v_lat)::geography,
             ST_MakePoint(u.lng,  u.lat)::geography
           ) / 1609.344
      ELSE NULL
    END                            AS distance_miles
  FROM public.freelancer_profiles fp
  JOIN public.users u ON u.id = fp.user_id
  LEFT JOIN best_media bm ON bm.fp_id = fp.id
  WHERE fp.user_id != p_user_id
    AND fp.verification_status != 'rejected'
    AND (
      v_lat    IS NULL OR v_lng    IS NULL
      OR u.lat IS NULL OR u.lng   IS NULL
      OR v_radius IS NULL
      OR ST_Distance(
           ST_MakePoint(v_lng, v_lat)::geography,
           ST_MakePoint(u.lng,  u.lat)::geography
         ) / 1609.344 <= v_radius
    )
  ORDER BY
    CASE WHEN v_service_prefs IS NOT NULL
              AND fp.service_categories && v_service_prefs
         THEN 0 ELSE 1
    END,
    fp.updated_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feed_items(UUID, INTEGER, INTEGER) TO authenticated;
