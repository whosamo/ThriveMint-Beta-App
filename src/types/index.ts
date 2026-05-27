export type UserRole = 'business' | 'freelancer' | 'both';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type Availability = 'full_time' | 'part_time' | 'contract' | 'unavailable';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  radius_preference_miles: number;
  created_at: string;
  updated_at: string;
}

export interface FreelancerProfile {
  id: string;
  user_id: string;
  bio: string | null;
  hourly_rate: number | null;
  availability: Availability | null;
  years_experience: number | null;
  service_categories: string[];
  portfolio_urls: string[];
  verification_status: VerificationStatus;
  badges: string[];
}

export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  industry: string | null;
  bio: string | null;
  website: string | null;
  service_preferences: string[];
  budget_range: string | null;
  verification_status: VerificationStatus;
}
