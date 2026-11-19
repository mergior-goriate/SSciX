"use client";

import { Building2, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import Avatar from "../avatar";
import { roles, type Profile } from "../profile-data";
import { useNetworkData } from "./network-ui";

export default function FeedProfileCard() {
  const { data: profile } = useNetworkData<Profile>("/profiles/me");
  const location = [profile?.city, profile?.country].filter(Boolean).join(", ");
  const role = profile && profile.academic_role !== "other" ? roles[profile.academic_role] : "";

  return <Link href="/perfil" className="panel feed-profile-card"
    aria-label={profile ? `Meu perfil: ${profile.name}` : "Meu perfil"}>
    <span className="feed-profile-cover" aria-hidden="true" />
    <div className="feed-profile-body">
      {profile
        ? <Avatar name={profile.name} photo={profile.photo} className="feed-profile-avatar" />
        : <span className="feed-profile-avatar"><UserRound size={24} aria-hidden="true" /></span>}
      <strong>{profile?.name || "Meu perfil"}</strong>
      {role && <span>{role}</span>}
      {location && <span><MapPin size={15} aria-hidden="true" />{location}</span>}
      {profile?.institution && <span><Building2 size={15} aria-hidden="true" />{profile.institution}</span>}
    </div>
  </Link>;
}
