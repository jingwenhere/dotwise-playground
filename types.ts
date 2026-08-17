export type Track = {
  id: string;
  spotify_track_id: string;
  title: string;
  artist: string;
  image: string;
  note: string;
  duration_ms?: number;
  position: { x: number; y: number };
};
export type Mixtape = {
  id: string;
  title: string;
  description: string;
  recipient: string;
  cover_image: string;
  mood: string;
  published: boolean;
  tracks: Track[];
  side_break?: number;
};
