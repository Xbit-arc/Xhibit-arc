import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import "./Follow.css";

// Helper: get avatar URL from storage or URL
async function getAvatarUrl(path) {
  if (!path) return "/images/default_avatar.png";
  try {
    if (path.startsWith("http")) return path;
    const { data: publicData } = await supabase.storage.from("avatars").getPublicUrl(path);
    if (publicData?.publicUrl) return publicData.publicUrl;
    const { data: signedData } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
    return signedData?.data?.signedUrl ?? "/images/default_avatar.png";
  } catch {
    return "/images/default_avatar.png";
  }
}

// Helper: get cover URL from storage or URL
async function getCoverUrl(path) {
  if (!path) return "";
  try {
    if (path.startsWith("http")) return path;
    const { data: publicData } = await supabase.storage.from("covers").getPublicUrl(path);
    if (publicData?.publicUrl) return publicData.publicUrl;
    const { data: signedData } = await supabase.storage.from("covers").createSignedUrl(path, 3600);
    return signedData?.data?.signedUrl ?? "";
  } catch {
    return "";
  }
}

// Profile card component
const ProfileCard = ({ profile, isFollowed, onToggleFollow }) => {
  const [localFollowed, setLocalFollowed] = useState(Boolean(isFollowed));

  const toggle = async () => {
    setLocalFollowed((prev) => !prev);
    if (onToggleFollow) await onToggleFollow(profile.id, !localFollowed);
  };

  const displayName =
    `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User";

  return (
    <div className="follow-card">
      <div
        className="follow-card-cover"
        style={{ backgroundImage: `url(${profile.cover || ""})` }}
      />
      <div className="follow-card-avatar-container">
        <img
          src={profile.avatar || "/images/default_avatar.png"}
          alt={displayName}
          className="follow-card-avatar"
        />
      </div>
      <div className="follow-card-info">
        <div className="follow-card-name">{displayName}</div>
        {profile.course && <div className="follow-card-course">{profile.course}</div>}
        {profile.specialization && <div className="follow-card-specialization">{profile.specialization}</div>}
        <button
          className={`follow-card-btn${localFollowed ? " followed" : ""}`}
          onClick={toggle}
        >
          {localFollowed ? "Followed" : "Follow"}
        </button>
      </div>
    </div>
  );
};

// Communities page
export default function Communities() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [currentUserId, setCurrentUserId] = useState(null);

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user || null;
      setCurrentUserId(user?.id ?? null);

      // Load current user's following IDs
      let followRows = [];
      if (user?.id) {
        const { data: fdata, error } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);
        if (!error && Array.isArray(fdata)) followRows = fdata.map((r) => r.following_id);
      }
      setFollowingIds(new Set(followRows));

      // Fetch users (profiles table first)
      let rows = [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar, avatar_url, avatar_path, cover, cover_path, course, specialization")
        .neq("id", user?.id || "")
        .limit(200);
      if (Array.isArray(profs)) rows = profs;

      // Fallback to settings table if profiles empty
      if (rows.length === 0) {
        const { data: sets } = await supabase
          .from("settings")
          .select("*")
          .neq("id", user?.id || "")
          .limit(200);
        if (Array.isArray(sets)) rows = sets;
      }

      // Normalize avatar and cover URLs
      const normalized = await Promise.all(
        rows.map(async (r) => {
          const avatarPath = r.avatar_path || r.avatar_url || r.avatar;
          const coverPath = r.cover_path || r.cover;
          return {
            id: r.id,
            first_name: r.first_name,
            last_name: r.last_name,
            avatar: await getAvatarUrl(avatarPath),
            cover: await getCoverUrl(coverPath),
            course: r.course,
            specialization: r.specialization,
          };
        })
      );

      setUsers(normalized);
    } catch (err) {
      console.error("loadCommunities error", err);
      setUsers([]);
      setFollowingIds(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const toggleFollow = async (targetUserId, shouldFollow) => {
    if (!currentUserId) return alert("Please sign in to follow users.");
    try {
      if (shouldFollow) {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: targetUserId });
        setFollowingIds((prev) => new Set(prev).add(targetUserId));
      } else {
        await supabase.from("follows").delete().match({ follower_id: currentUserId, following_id: targetUserId });
        setFollowingIds((prev) => {
          const s = new Set(prev);
          s.delete(targetUserId);
          return s;
        });
      }
    } catch (err) {
      console.error("toggleFollow error", err);
      await loadCommunities();
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading users...</div>;
  if (!users.length) return <div style={{ padding: 24 }}>No users found.</div>;

  return (
    <div className="follow-bg">
      <div style={{ marginTop: 80 }} />
      <div className="follow-grid" style={{ padding: 24 }}>
        {users.map((u) => (
          <ProfileCard
            key={u.id}
            profile={u}
            isFollowed={followingIds.has(u.id)}
            onToggleFollow={toggleFollow}
          />
        ))}
      </div>
    </div>
  );
}
