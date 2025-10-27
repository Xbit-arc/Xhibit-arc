import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './ProjectDetails.css';
import { FaGlobe, FaGithub } from 'react-icons/fa';

async function getDisplayUrlForPath(bucket, path) {
  if (!path) return null;
  try {
    if (typeof path === 'string' && path.startsWith('http')) return path;
    const pub = await supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pub?.data?.publicUrl ?? pub?.publicURL ?? null;
    if (publicUrl) return publicUrl;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  } catch (err) {
    console.error('getDisplayUrlForPath error', err);
    return null;
  }
}

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [imageUrls, setImageUrls] = useState([]);
  const [ownerName, setOwnerName] = useState('');
  const [ownerAvatar, setOwnerAvatar] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const { data: projRows, error: projErr } = await supabase
          .from('projects')
          .select('id, title, description, owner, thumbnail_path, thumbnail_display, gallery_paths, project_link, repo_link, created_at')
          .eq('id', id)
          .single();

        if (projErr || !projRows) {
          if (mounted) setProject(null);
          return;
        }
        if (mounted) setProject(projRows);

        let paths = [];
        if (Array.isArray(projRows.gallery_paths) && projRows.gallery_paths.length) {
          paths = projRows.gallery_paths.slice();
        } else if (projRows.thumbnail_path) {
          paths = [projRows.thumbnail_path];
        } else if (projRows.thumbnail_display) {
          paths = [projRows.thumbnail_display];
        }

        const urls = await Promise.all(paths.map(async (p) => await getDisplayUrlForPath('projects', p)));
        if (mounted) setImageUrls(urls.filter(Boolean));

        const ownerId = projRows.owner;
        if (ownerId) {
          let name = '';
          let avatar = null;
          const { data: s } = await supabase.from('settings').select('first_name,last_name,avatar_url').eq('id', ownerId).maybeSingle();
          if (s) {
            name = `${s.first_name || ''} ${s.last_name || ''}`.trim();
            avatar = s.avatar_url ?? null;
          }
          if (!name) {
            const { data: p } = await supabase.from('profiles').select('username').eq('id', ownerId).maybeSingle();
            if (p) name = p.username ?? '';
          }
          if (avatar) {
            const resolved = await getDisplayUrlForPath('avatars', avatar);
            if (mounted) setOwnerAvatar(resolved || null);
          }
          if (mounted) setOwnerName(name || '');
        }
      } catch (err) {
        console.error('ProjectDetails load error', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="project-loading">Loading...</div>;
  if (!project) return <div className="project-loading">Project not found</div>;

  return (
    <div className="project-details-page">
      <div className="project-header">
        <button className="project-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="project-meta">
          <div className="project-title">{project.title}</div>

          <div className="project-owner">
            {ownerAvatar ? (
              <img src={ownerAvatar} alt={ownerName || 'author'} className="project-owner-avatar" />
            ) : (
              <div className="project-owner-avatar placeholder" />
            )}
            <span className="project-owner-name">{ownerName || (project.owner ?? '').slice(0, 8)}</span>
          </div>

          {/* 🔗 LINKS BELOW OWNER */}
          <div className="project-links-under-owner">
            {project.project_link && (
              <a href={project.project_link} target="_blank" rel="noopener noreferrer">
                <FaGlobe className="link-icon globe" /> <span>Project Website</span>
              </a>
            )}
            {project.repo_link && (
              <a href={project.repo_link} target="_blank" rel="noopener noreferrer">
                <FaGithub className="link-icon github" /> <span>GitHub Repository</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Images Section */}
      <div className="project-images-column">
        {imageUrls.length === 0 ? (
          <div className="project-empty">No images for this project</div>
        ) : (
          imageUrls.map((u, idx) => (
            <div key={idx} className="project-image-block" role="img" aria-label={`Project image ${idx + 1}`}>
              <img src={u} alt={`${project.title} ${idx + 1}`} className="project-image" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
