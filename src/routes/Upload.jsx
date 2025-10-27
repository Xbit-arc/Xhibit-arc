import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './Upload.css';

export default function Upload() {
  const [showForm, setShowForm] = useState(false);
  const [showGridUploader, setShowGridUploader] = useState(false);
  const [showProjectContent, setShowProjectContent] = useState(false);

  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [selectedThumbnailFile, setSelectedThumbnailFile] = useState(null);
  const [gridImageUrls, setGridImageUrls] = useState([]); // { id, file, url }
  const [thumbnailId, setThumbnailId] = useState(null);

  const thumbnailFileInputRef = useRef(null);
  const sidebarFileInputRef = useRef(null);
  const gridFileInputRef = useRef(null);
  const formRef = useRef(null);
  const navigate = useNavigate();

  const PROJECTS_BUCKET = 'projects'; // exact bucket id (lowercase)

  const handleCancel = () => {
    setShowForm(false);
    setShowGridUploader(false);
    setShowProjectContent(false);
    setThumbnailUrl(null);
    setSelectedThumbnailFile(null);
    setGridImageUrls([]);
    setThumbnailId(null);
  };

  const handleTextClick = () => { setShowGridUploader(false); setShowProjectContent(false); setShowForm(true); };
  const handleGridClick = () => { setThumbnailUrl(null); setSelectedThumbnailFile(null); setShowForm(false); setShowProjectContent(false); setShowGridUploader(true); };

  // upload helper returns { path, url }
  const uploadFileToStorage = async (file, userId, folder = 'media') => {
    if (!file) throw new Error('file required');
    if (!userId) throw new Error('userId required');

    const ext = (file.name || 'file').split('.').pop();
    const filename = `${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
    const path = `${userId}/${folder}/${filename}`; // ensures first path segment is userId (policy expects this)

    const { data, error } = await supabase.storage.from(PROJECTS_BUCKET).upload(path, file, { cacheControl: '3600', upsert: true });
    if (error) {
      throw new Error(error.message || 'Storage upload failed');
    }

    // Try createSignedUrl first (temporary)
    try {
      const signedResp = await supabase.storage.from(PROJECTS_BUCKET).createSignedUrl(path, 60 * 60);
      if (signedResp?.data?.signedUrl) return { path, url: signedResp.data.signedUrl };
    } catch (_) {
      // fallthrough to public url
    }

    const publicResp = await supabase.storage.from(PROJECTS_BUCKET).getPublicUrl(path);
    const publicUrl = publicResp?.data?.publicUrl ?? publicResp?.publicURL ?? null;
    return { path, url: publicUrl || path };
  };

  const handleUpload = async (event) => {
    if (event) event.preventDefault();

    try {
      // Get authenticated user
      const { data: sessionData } = await supabase.auth.getSession();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        alert('You must be signed in to upload. Please sign in first.');
        return;
      }

      // collect form fields
      const formEl = formRef?.current;
      const title = formEl ? formEl['project-title'].value.trim() : (document.getElementById('project-title')?.value || '').trim();
      if (!title) { alert('Please provide a project title.'); setShowForm(true); return; }
      const description = formEl ? formEl['project-description'].value.trim() : (document.getElementById('project-description')?.value || '').trim();
      const creator = formEl ? formEl['creator-name'].value.trim() : (document.getElementById('creator-name')?.value || '').trim();
      const projectLink = formEl ? formEl['project-link'].value.trim() : (document.getElementById('project-link')?.value || '').trim();
      const repoLink = formEl ? formEl['repository-link'].value.trim() : (document.getElementById('repository-link')?.value || '').trim();

      // upload thumbnail (if provided)
      let thumbnail_path = null;
      if (selectedThumbnailFile) {
        const res = await uploadFileToStorage(selectedThumbnailFile, user.id, 'thumbnails');
        if (!res?.path) throw new Error('Thumbnail upload failed');
        thumbnail_path = String(res.path);
      } else if (thumbnailId !== null) {
        const thumbObj = gridImageUrls.find(i => i.id === thumbnailId);
        if (thumbObj?.file) {
          const res = await uploadFileToStorage(thumbObj.file, user.id, 'thumbnails');
          if (!res?.path) throw new Error('Thumbnail upload failed');
          thumbnail_path = String(res.path);
        }
      }

      // upload gallery files in parallel (if any)
      let gallery_paths = [];
      if (Array.isArray(gridImageUrls) && gridImageUrls.length > 0) {
        const uploadPromises = gridImageUrls.map(imgObj => {
          if (!imgObj?.file) return Promise.resolve(null);
          return uploadFileToStorage(imgObj.file, user.id, 'gallery').catch(err => {
            console.error('gallery upload error for one image:', err);
            return null;
          });
        });

        const results = await Promise.all(uploadPromises);
        gallery_paths = results.filter(Boolean).map(r => String(r.path));
      }

      // build payload with owner set to current user.id (string)
      const payload = {
        owner: String(user.id),
        title: String(title),
        description: description || null,
        creator: creator || null,
        project_link: projectLink || null,
        repo_link: repoLink || null,
        thumbnail_path: thumbnail_path || null,
        gallery_paths: gallery_paths.length ? gallery_paths : null,
        created_at: new Date()
      };

      // Insert and request the new id back
      const { data: inserted, error: insertErr } = await supabase
        .from('projects')
        .insert(payload)
        .select('id')
        .single();

      if (insertErr || !inserted?.id) {
        const msg = insertErr?.message || 'Insert failed';
        alert('Insert failed: ' + msg);
        console.error('[handleUpload] insertErr:', insertErr);
        return;
      }

      handleCancel();
      // Navigate to the project detail page
      navigate(`/project/${inserted.id}`);
    } catch (err) {
      console.error('[handleUpload] error:', err);
      alert(err?.message || 'Upload failed');
    }
  };

  const handleFormSubmit = async (e) => { e.preventDefault(); await handleUpload(e); };

  const handleThumbnailClick = (ref) => ref.current?.click();

  const handleThumbnailFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setThumbnailUrl(URL.createObjectURL(file));
      setSelectedThumbnailFile(file);
      setGridImageUrls([]);
      setThumbnailId(null);
      setShowForm(false);
      setShowGridUploader(false);
      setShowProjectContent(true);
    }
    event.target.value = null;
  };

  const handleGridFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const newImgs = files.map((file, idx) => ({ id: Date.now() + idx, file, url: URL.createObjectURL(file) }));
    setGridImageUrls(prev => {
      const updated = [...prev, ...newImgs];
      if (thumbnailId === null && updated.length > 0) setThumbnailId(updated[0].id);
      return updated;
    });
    setSelectedThumbnailFile(null);
    setThumbnailUrl(null);
    event.target.value = null;
  };

  const handleSetThumbnail = (id) => {
    setThumbnailId(id);
    const found = gridImageUrls.find(g => g.id === id);
    if (found) {
      setSelectedThumbnailFile(found.file);
      setThumbnailUrl(found.url);
    }
  };

  const handleDoneClick = () => {
    setShowGridUploader(false);
    setShowProjectContent(true);
  };

  const renderMainContent = () => {
    if (showProjectContent && (thumbnailUrl || gridImageUrls.length > 0)) {
      let currentThumbnailUrl = thumbnailUrl;
      if (gridImageUrls.length > 0) {
        const finalThumbnailId = (thumbnailId === null && gridImageUrls.length > 0) ? gridImageUrls[0].id : thumbnailId;
        const sel = gridImageUrls.find(i => i.id === finalThumbnailId);
        currentThumbnailUrl = sel?.url;
      }
      return (
        <div className="content-preview-container">
          <h3>Project Thumbnail</h3>
          {currentThumbnailUrl && <img src={currentThumbnailUrl} alt="Project Thumbnail" className="uploaded-project-preview" />}
          {gridImageUrls.length > 0 && (
            <>
              <h3 style={{ marginTop: 0, borderTop: '1px solid #eee', paddingTop: 20 }}>Project Preview Gallery ({gridImageUrls.length} images)</h3>
              <div className="final-grid-display">{gridImageUrls.map(image => <img key={image.id} src={image.url} alt={`Gallery ${image.id}`} className="final-preview-image" />)}</div>
            </>
          )}
          <p className="preview-caption">Content added. Use the sidebar to continue building or to edit details.</p>
        </div>
      );
    }

    if (showGridUploader) {
      return (
        <div className="grid-uploader-container">
          <h3>Project Preview Gallery</h3>
          <div className="current-grid-images">
            {gridImageUrls.length > 0 ? gridImageUrls.map(image => (
              <div key={image.id} className={`grid-image-wrapper ${image.id === thumbnailId || (thumbnailId === null && image.id === gridImageUrls[0].id) ? 'is-thumbnail' : ''}`} onClick={() => handleSetThumbnail(image.id)}>
                <img src={image.url} alt={`Gallery ${image.id}`} className="grid-preview-image" />
                {(image.id === thumbnailId || (thumbnailId === null && image.id === gridImageUrls[0].id)) && <span className="thumbnail-badge">Thumbnail</span>}
              </div>
            )) : <p className="empty-grid-message">Click below to start building your image gallery.</p>}
          </div>

          <button type="button" className="btn-add-grid-images" onClick={() => handleThumbnailClick(gridFileInputRef)}>+ Add More Pictures</button>
          <input type="file" ref={gridFileInputRef} onChange={handleGridFileChange} accept="image/*" multiple style={{ display: 'none' }} />

          <button type="button" className="btn-save-details" onClick={handleDoneClick}>Done</button>
          <button type="button" className="btn-cancel" onClick={() => setShowGridUploader(false)}>Cancel</button>
        </div>
      );
    }

    if (showForm) {
      return (
        <form className="project-details-form" onSubmit={handleFormSubmit} ref={formRef}>
          <div className="form-group"><label htmlFor="project-title">*Project Title*</label><input type="text" id="project-title" name="project-title" required /></div>
          <div className="form-group"><label htmlFor="project-description">*Description</label><textarea id="project-description" name="project-description" rows="5" /></div>
          <div className="form-group"><label htmlFor="creator-name">Creator Name</label><input type="text" id="creator-name" name="creator-name" /></div>
          <div className="form-group"><label htmlFor="project-link">Project Link (URL)</label><input type="url" id="project-link" name="project-link" /></div>
          <div className="form-group"><label htmlFor="repository-link">Github link</label><input type="url" id="repository-link" name="repository-link" /></div>

          <button type="submit" className="btn-save-details">Save Details & Upload</button>
          <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
        </form>
      );
    }

    return (
      <div className="content-starter-grid">
        <button className="starter-icon-btn" onClick={() => handleThumbnailClick(thumbnailFileInputRef)}><span className="icon">🏞️</span><span className="label">Project Thumbnail</span></button>
        <button className="starter-icon-btn" onClick={handleTextClick}><span className="icon">T</span><span className="label">Description</span></button>
        <button className="starter-icon-btn" onClick={handleGridClick}><span className="icon">🌐</span><span className="label">Project Preview</span></button>

        <input type="file" ref={thumbnailFileInputRef} onChange={handleThumbnailFileChange} accept="image/*" style={{ display: 'none' }} />
      </div>
    );
  };

  return (
    <div className="upload-wrapper">
      <main className="editor-main-content">
        <div className="welcome-section">
          <h2>{showForm ? 'Enter Project Details' : (showGridUploader ? 'Upload Project Gallery' : 'Project Content Editor')}</h2>
          {renderMainContent()}
        </div>
      </main>

      <aside className="editor-sidebar">
        <div className="sidebar-section">
          <h3>Add Content</h3>
          <div className="sidebar-content-grid">
            <button className="sidebar-content-btn" onClick={() => handleThumbnailClick(sidebarFileInputRef)}><span className="icon">🏞️</span><span className="label">Project Thumbnail</span></button>
            <button className="sidebar-content-btn" onClick={handleTextClick}><span className="icon">T</span><span className="label">Description</span></button>
            <button className="sidebar-content-btn" onClick={handleGridClick}><span className="icon">🌐</span><span className="label">Project Preview</span></button>

            <input type="file" ref={sidebarFileInputRef} onChange={handleThumbnailFileChange} accept="image/*" style={{ display: 'none' }} />
            <input type="file" ref={gridFileInputRef} onChange={handleGridFileChange} accept="image/*" multiple style={{ display: 'none' }} />
          </div>
        </div>

        <div className="button-group">
          <button className="btn-upload" onClick={handleUpload}>Upload</button>
          <button type="button" className="btn-cancel" onClick={handleCancel}>Cancel</button>
          <p className="custom-button-hint">Upload projects when ready!</p>
        </div>
      </aside>
    </div>
  );
  }