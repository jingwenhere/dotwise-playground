import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { images: { url: string }[] };
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ tracks: [] });
  const token = (await cookies()).get("spotify_access_token")?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Connect Spotify to search its catalog." },
      { status: 401 },
    );
  }
  const res = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: "Spotify search is unavailable." },
      { status: res.status },
    );
  }
  const data = await res.json();
  return NextResponse.json({
    tracks: data.tracks.items.map((track: SpotifyTrack) => ({
      spotify_track_id: track.id,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(", "),
      image: track.album.images[1]?.url || track.album.images[0]?.url,
      duration_ms: track.duration_ms,
    })),
  });
}
