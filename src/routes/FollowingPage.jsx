import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "./Follow.css";

// Helpers
async function getAvatarUrl(path) {
  if (!path) return "/images/default_avatar.png";
  try {
    if (path.startsWith("http")) return path;
    const { data: publicData } = await supabase.storage.from("avatars").getPublicUrl(path);
    if (publicData?.publicUrl) return publicData.publicUrl;
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
    return signed?.data?.signedUrl ?? "/images/default_avatar.png";
  } catch {
    return "/images/default_avatar.png";
  }
}

async function getCoverUrl(path) {
  if (!path) return "";
  try {
    if (path.startsWith("http")) return path;
    const { data: publicData } = await supabase.storage.from("covers").getPublicUrl(path);
    if (publicData?.publicUrl) return publicData.publicUrl;
    const { data: signed } = await supabase.storage.from("covers").createSignedUrl(path, 60 * 60);
    return signed?.data?.signedUrl ?? "";
  } catch {
    return "";
  }
}

// Profile Card
const ProfileCard = ({ profile, relation, onToggleFollow }) => {
  const [localRel, setLocalRel] = useState(relation);
  const bothFollow = localRel.isFollowed && localRel.followsYou;

  let label = "Follow";
  if (bothFollow) label = "Connected";
  else if (localRel.isFollowed) label = "Followed";
  else if (localRel.followsYou) label = "Follow Back";

  const btnClass = bothFollow
    ? "follow-card-btn connected"
    : localRel.isFollowed
    ? "follow-card-btn followed"
    : localRel.followsYou
    ? "follow-card-btn follow-back"
    : "follow-card-btn";

  const handleClick = async (e) => {
    e.stopPropagation(); // just in case
    if (bothFollow) return;
    const newIsFollowed = !localRel.isFollowed;
    setLocalRel({ ...localRel, isFollowed: newIsFollowed });
    if (onToggleFollow) await onToggleFollow(profile.id, newIsFollowed);
  };

  const displayName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User";

  return (
    <div className="follow-card">
      <div
        className="follow-card-cover"
        style={{ backgroundImage: `url(${profile.cover || ""})` }}
      />
      <div className="follow-card-avatar-container">
        <img className="follow-card-avatar" src={profile.avatar} alt={displayName} />
      </div>
      <div className="follow-card-info">
        <div className="follow-card-name">{displayName}</div>
        <div className="follow-card-btn-container">
          <button className={btnClass} onClick={handleClick} disabled={bothFollow}>
            {label}
          </button>
        </div>
      </div>
    </div>
  );
};

// Following Page
export default function FollowingPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [relations, setRelations] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        setProfiles([]);
        setRelations({});
        setCurrentUserId(null);
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      const { data: iFollowData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const { data: theyFollowData } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", user.id);

      const iFollowIds = iFollowData?.map(r => r.following_id).filter(Boolean) || [];
      const theyFollowIds = theyFollowData?.map(r => r.follower_id).filter(Boolean) || [];

      const allIds = Array.from(new Set([...iFollowIds, ...theyFollowIds]));
      if (!allIds.length) {
        setProfiles([]);
        setRelations({});
        setLoading(false);
        return;
      }

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar, avatar_url, avatar_path, cover, cover_path")
        .in("id", allIds);

      const missingIds = allIds.filter(id => !profileRows?.some(p => p.id === id));
      let settingsRows = [];
      if (missingIds.length) {
        const { data: srows } = await supabase.from("settings").select("*").in("id", missingIds);
        settingsRows = srows || [];
      }

      const allRows = [...(profileRows || []), ...settingsRows];

      const normalized = await Promise.all(allIds.map(async id => {
        const row = allRows.find(r => String(r.id) === String(id)) || {};
        const avatar = await getAvatarUrl(row.avatar_path || row.avatar_url || row.avatar);
        const cover = await getCoverUrl(row.cover_path || row.cover);
        return {
          id,
          first_name: row.first_name,
          last_name: row.last_name,
          avatar: avatar || "/images/default_avatar.png",
          cover: cover || "",
        };
      }));

      const relationMap = {};
      allIds.forEach(id => {
        relationMap[id] = {
          isFollowed: iFollowIds.includes(id),
          followsYou: theyFollowIds.includes(id),
        };
      });

      setProfiles(normalized);
      setRelations(relationMap);
    } catch (err) {
      console.error(err);
      setProfiles([]);
      setRelations({});
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (targetId, shouldFollow) => {
    if (!currentUserId) return alert("Please sign in to follow users.");
    try {
      if (shouldFollow)
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: targetId });
      else
        await supabase.from("follows").delete().match({ follower_id: currentUserId, following_id: targetId });
      await loadData();
    } catch (err) {
      console.error(err);
      await loadData();
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!profiles.length) return <div style={{ padding: 24 }}>No connections yet.</div>;

  return (
    <div className="follow-bg follow-container">
      <div style={{ marginTop: 80 }} />
      <div className="follow-grid">
        {profiles.map(p => (
          <ProfileCard
            key={p.id}
            profile={p}
            relation={relations[p.id] || { isFollowed: false, followsYou: false }}
            onToggleFollow={toggleFollow}
          />
        ))}
      </div>
    </div>
  );
}
