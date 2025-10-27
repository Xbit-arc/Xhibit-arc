import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './navbar.css';
import { supabase } from '../supabaseClient';

import XhibitLogo from '../assets/XhibitLogo.png';
import SearchIcon from '../assets/SearchIcon.png';
import Binoculars from '../assets/Binoculars.png';
import Heart from '../assets/Heart.png';
import UsersThree from '../assets/UsersThree.png';
import UploadSimple from '../assets/UploadSimple.png';
import UserProfile from '../assets/UserProfile.png';

// Removed Folder icon
const NAV_ICONS = [
  { src: Binoculars, alt: 'Binoculars', label: 'Homepage', to: '/homepage' },
  { src: Heart, alt: 'Heart', label: 'Follow', to: '/follow' },
  { src: UsersThree, alt: 'Users', label: 'Designers', to: '/communities' }, // label changed to Designers
  { src: UploadSimple, alt: 'Upload', label: 'Upload', to: '/upload' },
];

const Navbar = () => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [openResults, setOpenResults] = useState(false);
  const [activeIcon, setActiveIcon] = useState('Home');
  const [avatarSrc, setAvatarSrc] = useState(UserProfile);
  const [currentUserId, setCurrentUserId] = useState(null);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadAvatar = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) return;

        setCurrentUserId(user.id);

        const { data } = await supabase
          .from('settings')
          .select('avatar_url')
          .eq('id', user.id)
          .single();

        let avatarValue = data?.avatar_url || null;
        if (!avatarValue) return;

        if (avatarValue.startsWith('http')) {
          if (mounted) setAvatarSrc(avatarValue);
          return;
        }

        const { data: signedData } = await supabase.storage
          .from('avatars')
          .createSignedUrl(avatarValue, 60 * 60);

        if (signedData?.signedUrl && mounted) {
          setAvatarSrc(signedData.signedUrl);
          return;
        }

        const { data: publicData } = await supabase.storage
          .from('avatars')
          .getPublicUrl(avatarValue);

        const publicUrl = publicData?.publicUrl ?? publicData?.data?.publicUrl;
        if (publicUrl && mounted) setAvatarSrc(publicUrl);
      } catch (err) {
        console.error('Failed to load avatar:', err);
      }
    };

    loadAvatar();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) loadAvatar();
      else {
        setAvatarSrc(UserProfile);
        setCurrentUserId(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  // Close search when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenResults(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Helper for Supabase Storage URL
  const resolveStorageUrl = async (bucket, path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;

    try {
      const { data: signedData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);
      if (signedData?.signedUrl) return signedData.signedUrl;
    } catch {}

    try {
      const { data: publicData } = await supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      return publicData?.publicUrl ?? publicData?.data?.publicUrl ?? null;
    } catch {
      return null;
    }
  };

  // Unified search
  const searchEntities = async (term) => {
    if (!term?.trim()) return [];
    const pattern = `%${term}%`;

    const [profilesRes, settingsRes, projectsRes] = await Promise.all([
      supabase.from('profiles').select('id, username').ilike('username', pattern).limit(10),
      supabase.from('settings').select('id, first_name, last_name, avatar_url').or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`).limit(10),
      supabase.from('projects').select('id, title, thumbnail_path').ilike('title', pattern).limit(10),
    ]);

    const map = new Map();

    (profilesRes.data || []).forEach((r) => {
      map.set(`user:${r.id}`, { id: r.id, type: 'user', label: r.username || r.id, imgPath: null });
    });

    (settingsRes.data || []).forEach((s) => {
      const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();
      const key = `user:${s.id}`;
      if (!map.has(key)) map.set(key, { id: s.id, type: 'user', label: name || s.id, imgPath: s.avatar_url ?? null });
      else {
        const prev = map.get(key);
        map.set(key, { ...prev, label: name || prev.label, imgPath: s.avatar_url ?? prev.imgPath });
      }
    });

    (projectsRes.data || []).forEach((p) => {
      map.set(`project:${p.id}`, { id: p.id, type: 'project', label: p.title || p.id, imgPath: p.thumbnail_path ?? null });
    });

    const items = Array.from(map.values()).slice(0, 12);
    return Promise.all(items.map(async (it) => {
      if (!it.imgPath) return { ...it, img: null };
      const bucket = it.type === 'user' ? 'avatars' : 'projects';
      const url = await resolveStorageUrl(bucket, it.imgPath);
      return { ...it, img: url || null };
    }));
  };

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!search) {
      setResults([]);
      setOpenResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await searchEntities(search);
      setResults(res);
      setOpenResults(res.length > 0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const goToResult = (item) => {
    setOpenResults(false);
    setSearch('');
    if (item.type === 'user') navigate(`/usersprofile/${item.id}`);
    else navigate(`/project/${item.id}`);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!search.trim()) return;
    const res = await searchEntities(search.trim());
    if (res.length === 1) return goToResult(res[0]);
    navigate(`/searchresults?query=${encodeURIComponent(search.trim())}`);
    setSearch('');
    setOpenResults(false);
  };

  const profileLink = currentUserId ? `/usersprofile/${currentUserId}` : '/usersprofile';

  return (
    <div className="navbar-container">
      <div className="navbar">
        {/* Logo */}
        <div className={`navbar-logo hover-letter${activeIcon === 'Home' ? ' active-icon' : ''}`}>
          <Link to="/homepage" onClick={() => setActiveIcon('Home')}>
            <img src={XhibitLogo} alt="Xhibit Logo" />
            <span className="icon-letter">Home</span>
          </Link>
        </div>

        {/* Search Bar */}
        <form className="navbar-search-bar" onSubmit={handleSubmit} ref={containerRef}>
          <div className="navbar-search-content">
            <img src={SearchIcon} alt="Search" className="navbar-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="navbar-search-text"
              placeholder="Search User or Project Title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => results.length && setOpenResults(true)}
            />
          </div>

          {openResults && results.length > 0 && (
            <div className="search-results-dropdown">
              {results.map((u) => (
                <div
                  key={`${u.type}:${u.id}`}
                  className="search-result-row"
                  onClick={() => goToResult(u)}
                >
                  <img src={u.img || UserProfile} alt="" className="search-result-avatar" />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div className="search-result-label">{u.label}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{u.type === 'user' ? 'User' : 'Project'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Icons */}
        <div className="navbar-links">
          {NAV_ICONS.map((icon) => (
            <Link
              key={icon.label}
              to={icon.to}
              className={`icon-link hover-letter${activeIcon === icon.label ? ' active-icon' : ''}`}
              onClick={() => setActiveIcon(icon.label)}
            >
              <img src={icon.src} alt={icon.alt} />
              <span className="icon-letter">{icon.label}</span>
            </Link>
          ))}
          <Link
            to={profileLink}
            className={`user-profile hover-letter${activeIcon === 'User' ? ' active-icon' : ''}`}
            onClick={() => setActiveIcon('User')}
          >
            <img src={avatarSrc} alt="User Profile" className="user-avatar" />
            <span className="icon-letter">User</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;