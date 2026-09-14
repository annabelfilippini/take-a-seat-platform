/* eslint-disable @next/next/no-img-element */
import { getProfileImageObjectPosition, getProfileImageTransform } from "../_lib/profile-image";

type Identity = { name: string; image?: string | null; instagramHandle?: string; instagramUrl?: string; profileImagePositionX?: number | null; profileImagePositionY?: number | null; profileImageZoom?: number | null };
export function CreatorProfileIdentity({ profile, heading = "h2" }: { profile: Identity; heading?: "h1" | "h2" }) {
  const Heading = heading;
  const handle = profile.instagramHandle?.replace(/^@/, "");
  const href = profile.instagramUrl && /^https?:\/\//i.test(profile.instagramUrl) ? profile.instagramUrl : handle ? `https://www.instagram.com/${handle}` : undefined;
  return <div className="creator-profile-identity">
    <span className="creator-profile-avatar">{profile.image ? <img src={profile.image} alt={`${profile.name} profile`} style={{ objectPosition: getProfileImageObjectPosition(profile), transform: getProfileImageTransform(profile) }} /> : <span>{profile.name.slice(0, 2) || "TS"}</span>}</span>
    <Heading className="creator-preview-name">{profile.name || "Your name"}</Heading>
    {href ? <a className="creator-instagram-handle" href={href} target="_blank" rel="noreferrer">@{handle || "Instagram"}</a> : null}
  </div>;
}
