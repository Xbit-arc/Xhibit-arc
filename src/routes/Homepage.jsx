import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './Homepage.css';

// helper: build a display URL for a storage path (signed first, public fallback)
async function resolveStorageUrl(path) {
  if (!path) return null;
  try {
    if (typeof path === 'string' && path.startsWith('http')) return path;

    try {
      const signed = await supabase.storage.from('projects').createSignedUrl(path, 60 * 60);
      if (signed?.data?.signedUrl) return signed.data.signedUrl;
      if (signed?.data?.signedURL) return signed.data.signedURL;
    } catch (e) {
      // ignore signed url error and fall back to public url
    }

    try {
      const pub = await supabase.storage.from('projects').getPublicUrl(path);
      return pub?.data?.publicUrl ?? pub?.data?.publicURL ?? pub?.publicUrl ?? pub?.publicURL ?? null;
    } catch (e) {
      return null;
    }
  } catch (err) {
    console.error('resolveStorageUrl error', err);
    return null;
  }
}

export default function Homepage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!Array.isArray(data)) {
        setProjects([]);
        return;
      }

      // resolve thumbnail_display for each project
      const mapped = await Promise.all(data.map(async (p) => {
        if (p.thumbnail_display) return p; // already has a display url
        // prefer thumbnail_path, fall back to first gallery path
        const path = p.thumbnail_path || (Array.isArray(p.gallery_paths) && p.gallery_paths.length ? p.gallery_paths[0] : null);
        if (!path) return { ...p, thumbnail_display: null };
        const url = await resolveStorageUrl(path);
        return { ...p, thumbnail_display: url || null };
      }));

      setProjects(mapped);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleProjectClick = (projectId) => {
    navigate(`/project/${projectId}`);
  };

  if (loading) return <div className="p-8 text-center">Loading projects...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>Latest Projects</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16, marginTop: 16 }}>
        {projects.map(p => (
          <article
            key={p.id}
            onClick={() => handleProjectClick(p.id)}
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 12,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              transition: 'transform 0.2s ease-in-out'
            }}
          >
            <div style={{ height: 160, borderRadius: 6, overflow: 'hidden', background: '#f0f0f0' }}>
              {p.thumbnail_display ? (
                <img
                  src={p.thumbnail_display}
                  alt={p.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
                  No image
                </div>
              )}
            </div>
            <h3 style={{ marginTop: 12 }}>{p.title}</h3>
            <p style={{ color: '#444', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {p.description}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}