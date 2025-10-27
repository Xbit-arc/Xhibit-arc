import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './UsersProfile.css';

import FacebookIcon from '../assets/facebook.png';
import InstagramIcon from '../assets/IG.png';
import GithubIcon from '../assets/Github.png';
import LinkedInIcon from '../assets/linkin.png';
import ArrowSquareOutIcon from '../assets/ArrowSquareOut.png';
import UserProfileIcon from '../assets/UserProfile.png';
import { supabase } from '../supabaseClient';

const DEFAULT_COVER = null;

async function getDisplayUrlForPath(bucket, path) {
  if (!path) return null;
  try {
    if (typeof path === 'string' && path.startsWith('http')) return path;
    const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (signedData?.signedUrl) return signedData.signedUrl;
    const pub = await supabase.storage.from(bucket).getPublicUrl(path);
    return pub?.data?.publicUrl ?? null;
  } catch (err) {
    console.error('getDisplayUrlForPath error', err);
    return null;
  }
}

const ProfileLink = ({ iconSrc, label, url }) => {
  const open = (e) => {
    e?.stopPropagation();
    if (!url) return;
    const safe = url.startsWith('http') ? url : `https://${url}`;
    window.open(safe, '_blank', 'noopener,noreferrer');
  };
  return (
    <div
      className="profile-link-row"
      role={url ? 'button' : 'group'}
      tabIndex={url ? 0 : -1}
      onClick={open}
      onKeyDown={(e) => { if (url && (e.key === 'Enter' || e.key === ' ')) open(); }}
    >
      <div className="profile-link-label">
        <img src={iconSrc} alt="" className="profile-link-icon" />
        <span className="profile-link-text">{label}</span>
      </div>
      <img src={ArrowSquareOutIcon} alt="" className="profile-link-arrow" />
    </div>
  );
};

const UserWorkCard = ({ project, onClick, onDelete, canDelete }) => (
  <div className="work-frame" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}>
    <div className="work-image-container" onClick={onClick}>
      {project.imageUrl ? (
        <img src={project.imageUrl} alt={project.title} className="work-image" />
      ) : (
        <div className="work-image-placeholder">No Image</div>
      )}
      {canDelete && (
        <button
          type="button"
          className="project-delete-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
        >
          Delete
        </button>
      )}
    </div>
    <p className="work-title" onClick={onClick}>{project.title}</p>
  </div>
);

export default function UsersProfile() {
  const { id: routeUserId } = useParams();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState(UserProfileIcon);
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COVER);
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [projects, setProjects] = useState([]);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [links, setLinks] = useState({ facebook: '', instagram: '', github: '', linkedin: '' });
  const [profileUserId, setProfileUserId] = useState(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);

  const fileInputRef = useRef(null);
  const projectChannelRef = useRef(null);

  const handleAvatarClick = () => setIsAvatarPreviewOpen(true);
  const closeAvatarPreview = () => setIsAvatarPreviewOpen(false);

  useEffect(() => {
    let mounted = true;

    const loadProjects = async (userId) => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, thumbnail_path, gallery_paths, owner')
        .eq('owner', userId)
        .order('created_at', { ascending: false });
      if (error || !data) return setProjects([]);

      const mapped = await Promise.all(
        data.map(async (p) => {
          let path = p.thumbnail_path;
          if (!path && Array.isArray(p.gallery_paths) && p.gallery_paths.length)
            path = p.gallery_paths[0];
          const imageUrl = path ? await getDisplayUrlForPath('projects', path) : null;
          return { id: p.id, title: p.title, imageUrl };
        })
      );
      if (mounted) setProjects(mapped);
    };

    const loadFollowState = async (currentId, targetId) => {
      if (!currentId || !targetId || currentId === targetId) {
        setIsFollowing(false);
        setIsFollowed(false);
        return;
      }
      try {
        const { data: f1 } = await supabase
          .from('follows')
          .select('id')
          .match({ follower_id: currentId, following_id: targetId })
          .limit(1);
        const { data: f2 } = await supabase
          .from('follows')
          .select('id')
          .match({ follower_id: targetId, following_id: currentId })
          .limit(1);

        if (mounted) {
          setIsFollowing(Array.isArray(f1) && f1.length > 0);
          setIsFollowed(Array.isArray(f2) && f2.length > 0);
        }
      } catch (err) {
        console.error('loadFollowState error', err);
        if (mounted) {
          setIsFollowing(false);
          setIsFollowed(false);
        }
      }
    };

    const loadProfile = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData?.user;
      const targetId = routeUserId ?? currentUser?.id;
      setProfileUserId(targetId);
      setIsOwnProfile(currentUser?.id === targetId);

      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, display_name, username, avatar_url, avatar_path')
        .eq('id', targetId)
        .maybeSingle();

      let avatar = UserProfileIcon;
      if (settingsData?.avatar_url) avatar = await getDisplayUrlForPath('avatars', settingsData.avatar_url);
      else if (profileData?.avatar_url) avatar = await getDisplayUrlForPath('avatars', profileData.avatar_url);
      setAvatarUrl(avatar || UserProfileIcon);

      const coverPath = settingsData?.cover_path ?? settingsData?.cover ?? null;
      setCoverUrl(coverPath ? await getDisplayUrlForPath('covers', coverPath) : DEFAULT_COVER);

      const bioValue = settingsData?.bio ?? settingsData?.description ?? '';
      setLinks({
        facebook: settingsData?.facebook ?? '',
        instagram: settingsData?.instagram ?? '',
        github: settingsData?.github ?? '',
        linkedin: settingsData?.linkedin ?? '',
      });

      let first = settingsData?.first_name ?? settingsData?.firstname ?? settingsData?.first ?? '';
      let last = settingsData?.last_name ?? settingsData?.lastname ?? settingsData?.last ?? '';
      if ((!first || !last) && profileData) {
        first = first || profileData.first_name || '';
        last = last || profileData.last_name || '';
      }

      let finalName = settingsData?.display_name || `${first} ${last}`.trim() || profileData?.display_name || profileData?.username || 'User';

      if (mounted) {
        setDisplayName(finalName);
        setBio(bioValue || '');
      }

      await loadFollowState(currentUser?.id, targetId);
      await loadProjects(targetId);
    };

    loadProfile();

    const { subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!routeUserId) {
        if (session?.user?.id) loadProfile();
        else {
          setAvatarUrl(UserProfileIcon);
          setBio('');
          setProjects([]);
          setDisplayName('');
          setCoverUrl(DEFAULT_COVER);
          setLinks({ facebook: '', instagram: '', github: '', linkedin: '' });
          setIsFollowing(false);
          setIsFollowed(false);
        }
      }
    });

    return () => {
      mounted = false;
      if (subscription?.unsubscribe) subscription.unsubscribe();
      if (projectChannelRef.current) {
        try { projectChannelRef.current.unsubscribe(); } catch {}
        projectChannelRef.current = null;
      }
    };
  }, [routeUserId, navigate]);

  const toggleFollow = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const currentUser = userData?.user;
    if (!currentUser) { alert('Please sign in to follow users.'); return; }
    if (!profileUserId || currentUser.id === profileUserId) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .match({ follower_id: currentUser.id, following_id: profileUserId });
        if (error) throw error;
        setIsFollowing(false);
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUser.id, following_id: profileUserId }, { returning: 'minimal' });
        if (error) console.warn('follow insert error', error);
        setIsFollowing(true);
      }
    } catch (err) { console.error('toggleFollow error', err); alert('Failed to update follow.'); }
    finally { setFollowLoading(false); }
  };

  const deleteProject = async (projectId) => {
    if (!projectId) return;
    if (!window.confirm('Delete this project? This action cannot be undone.')) return;

    try {
      const { data: projRow, error } = await supabase
        .from('projects')
        .select('thumbnail_path, gallery_paths')
        .eq('id', projectId)
        .maybeSingle();
      if (error) throw error;

      const pathsToDelete = [];
      const collectPaths = (val) => {
        if (!val) return;
        if (Array.isArray(val)) pathsToDelete.push(...val.filter(Boolean));
        else if (typeof val === 'string') {
          try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) pathsToDelete.push(...parsed.filter(Boolean)); else pathsToDelete.push(parsed); }
          catch { pathsToDelete.push(val); }
        }
      };
      collectPaths(projRow?.thumbnail_path);
      collectPaths(projRow?.gallery_paths);

      if (pathsToDelete.length > 0) {
        const { error: rmErr } = await supabase.storage.from('projects').remove(pathsToDelete);
        if (rmErr) console.warn('Some files failed to delete', rmErr);
      }

      const { error: delErr } = await supabase.from('projects').delete().eq('id', projectId);
      if (delErr) throw delErr;

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) { console.error('Delete failed', err); alert('Failed to delete project.'); }
  };

  const handleCoverClick = () => { if (isOwnProfile && fileInputRef.current) fileInputRef.current.click(); };
  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      const path = `${user.id}/cover_${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('covers').upload(path, file, { upsert: true });
      if (error) throw error;
      const display = await getDisplayUrlForPath('covers', path);
      setCoverUrl(display);
      await supabase.from('settings').upsert({ id: user.id, cover_path: path });
    } catch (err) { console.error('Cover upload failed', err); }
  };

  const handleLogout = async () => { try { await supabase.auth.signOut(); navigate('/signin'); } catch (err) { console.error('Logout error', err); } };

  return (
    <div className="profile-page-container">
      <div className="profile-main-content">
        <header className="profile-header-section" onClick={handleCoverClick} role={isOwnProfile ? 'button' : 'region'}>
          {coverUrl ? (
            <div className="profile-cover-bg" style={{ backgroundImage: `url(${coverUrl})` }} />
          ) : (
            <div className="profile-cover-placeholder">
              <div className="cover-upload-area">
                <div className="cover-upload-icon">⬇</div>
                <div className="cover-upload-text">Upload a cover photo</div>
              </div>
            </div>
          )}
          {isOwnProfile && (
            <input ref={fileInputRef} type="file" accept="image/*" className="profile-cover-input" onChange={handleCoverChange} style={{ display: 'none' }} />
          )}
          <div className="profile-header-inner centered-avatar">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="avatar-wrap" onClick={handleAvatarClick}>
                <img src={avatarUrl} alt="Avatar" className="profile-avatar" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <h1 className="profile-name">{displayName}</h1>
              </div>
            </div>
          </div>
        </header>

        <div className="profile-details-layout">
          <aside className="profile-sidebar">
            {!isOwnProfile && (
              <div className="sidebar-follow-wrap" onClick={(e) => e.stopPropagation()}>
                <button
                  className={isFollowing ? 'profile-following-button' : (isFollowed ? 'profile-followback-button' : 'profile-follow-button')}
                  onClick={() => { if (!followLoading) toggleFollow(); }}
                  aria-pressed={isFollowing}
                  disabled={followLoading}
                >
                  {isFollowing ? 'Following' : (isFollowed ? 'Follow Back' : 'Follow')}
                </button>
              </div>
            )}

            <section className="profile-about-section">
              <h2 className="section-title">About</h2>
              <p className="about-description">{bio}</p>
            </section>

            <section className="profile-links-section">
              <h3 className="section-title">Links</h3>
              <ProfileLink iconSrc={FacebookIcon} label="Facebook" url={links.facebook} />
              <ProfileLink iconSrc={InstagramIcon} label="Instagram" url={links.instagram} />
              <ProfileLink iconSrc={GithubIcon} label="Github" url={links.github} />
              <ProfileLink iconSrc={LinkedInIcon} label="LinkedIn" url={links.linkedin} />
            </section>

            <section className="settings-container">
              <div className="settings-title">Settings</div>
              <div className="settings-item" onClick={() => navigate('/settings')}>General</div>
              <div className="settings-item logout" onClick={handleLogout}>Logout</div>
            </section>
          </aside>

          <main className="profile-works-section">
            <h3 className="section-title">Works</h3>
            <div className="works-list">
              {projects.length > 0 ? projects.map((p) => (
                <UserWorkCard
                  key={p.id}
                  project={p}
                  onClick={() => navigate(`/project/${p.id}`)}
                  onDelete={deleteProject}
                  canDelete={isOwnProfile}
                />
              )) : (
                <div className="no-works">No works yet</div>
              )}
            </div>
          </main>
        </div>

        {isAvatarPreviewOpen && (
          <div className="avatar-preview-modal" onClick={closeAvatarPreview}>
            <img src={avatarUrl} alt="Avatar Preview" className="avatar-preview-img" />
          </div>
        )}
      </div>
    </div>
  );
}
