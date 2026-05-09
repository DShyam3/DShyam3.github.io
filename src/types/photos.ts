export interface Photo {
  id: string;
  image_url: string;
  caption?: string;
  location?: string;
  created_at: Date;
}