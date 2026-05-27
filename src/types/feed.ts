export interface FeedItem {
  freelancer_id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  bio: string | null;
  hourly_rate: number | null;
  availability: string;
  service_categories: string[];
  verification_status: string;
  portfolio_media_url: string | null;
  portfolio_media_type: 'video' | 'image' | null;
  portfolio_title: string | null;
  portfolio_description: string | null;
  distance_miles: number | null;
}

export type PortfolioItemType = 'video' | 'image' | 'before_after' | 'testimonial';

export interface PortfolioItem {
  id: string;
  media_url: string;
  type: PortfolioItemType;
  title: string | null;
  description: string | null;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar_url: string | null;
}
