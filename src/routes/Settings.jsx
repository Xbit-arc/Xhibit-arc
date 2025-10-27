import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import "./Settings.css";
import DeleteModal from '../components/DeleteModal';

export default function Settings() {
  // inline SVG default avatar (fallback)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>
    <rect width='100%' height='100%' fill='#E6E9EE'/>
    <g transform='translate(60,40)' fill='none' stroke='#9AA6B2' stroke-width='6'>
      <circle cx='60' cy='60' r='60' fill='#C8D1DA' stroke='none'/>
      <path d='M60 120c-33 0-60 16-60 36v12h120v-12c0-20-27-36-60-36z' fill='#9AA6B2' stroke='none'/>
      <circle cx='60' cy='56' r='32' fill='#ffffff' opacity='0.06'/>
    </g>
  </svg>`;
  const defaultAvatar = "data:image/svg+xml;utf8," + encodeURIComponent(svg);

  const defaultProfile = {
    first_name: "",
    last_name: "",
    year_level: "",
    batch: "",
    address: "",
    portfolio_url: "",
    bio: "",
    username: "",
    account_email: "",
    avatar_url: "",
    avatar_path: "",

    // social link fields (stored as separate text columns in settings table)
    facebook: "",
    instagram: "",
    github: "",
    linkedin: ""
  };

  const [profile, setProfile] = useState(defaultProfile);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPreview, setSelectedPreview] = useState(null);

  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const basicRef = useRef(null);
  const bioRef = useRef(null);
  const teamsRef = useRef(null);
  const linksRef = useRef(null);
  const accountRef = useRef(null);
  const fileInputRef = useRef(null);
  // keep the last saved profile so Cancel can restore it
  const lastSavedProfileRef = useRef(defaultProfile);

  const { signOut } = UserAuth();
  const navigate = useNavigate();

  // build a display URL for a storage file path (signed for private, public fallback)
  const getDisplayUrlForPath = async (filePath) => {
    if (!filePath) return null;
    try {
      const { data: signedData, error: signedErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(filePath, 60 * 60);
      if (!signedErr && signedData?.signedUrl) return signedData.signedUrl;
      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      return publicData?.publicUrl ?? null;
    } catch {
      return null;
    }
  };

  // fetch profile: read settings row and merge with defaults
  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;
      if (userError || !user) throw new Error("User not found");

      const { data, error: dbErr } = await supabase.from("settings").select("*").eq("id", user.id).single();
      if (dbErr && dbErr.code !== "PGRST116") throw dbErr; // ignore no rows (PGRST116)

      const merged = { ...defaultProfile, ...(data || {}), account_email: user.email };

      // if DB value exists and looks like a storage path (no http), convert to display URL
      if (merged.avatar_url && !merged.avatar_url.startsWith("http")) {
        merged.avatar_path = merged.avatar_url;
        const url = await getDisplayUrlForPath(merged.avatar_url);
        if (url) merged.avatar_url = url;
        else merged.avatar_url = ""; // fallback if cannot build url
      } else {
        // avatar_url is empty or already a http url
        merged.avatar_path = merged.avatar_path || "";
      }

      // Ensure social fields exist
      merged.facebook = merged.facebook || "";
      merged.instagram = merged.instagram || "";
      merged.github = merged.github || "";
      merged.linkedin = merged.linkedin || "";

      setProfile(merged);
      // store the fetched profile as the last saved state
      lastSavedProfileRef.current = merged;
    } catch (err) {
      setError(err.message || "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line
  }, []);

  const handleSidebarClick = (ref) => ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleLogout = async (e) => {
    e?.preventDefault();
    try {
      await signOut();
      navigate("/signin");
    } catch {
      setError("An unexpected error occurred.");
    }
  };

  const handleChange = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });
  const handlePasswordChange = (e) => setPasswords({ ...passwords, [e.target.name]: e.target.value });

  // Upload file to storage only (do NOT upsert DB). Return storage path and display URL.
  const uploadFileToStorage = async (file, userId) => {
    if (!file) throw new Error("No file provided");
    if (!userId) throw new Error("User ID required");

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { cacheControl: "3600", upsert: true });
    if (uploadError) throw uploadError;

    const displayUrl = await getDisplayUrlForPath(filePath);
    return { filePath, displayUrl };
  };

  // Called when user selects a file input; only set state and preview (no upload yet)
  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setSelectedPreview(URL.createObjectURL(file));
  };

  // Save handler: upload avatar (if selected) then upsert settings including social links
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;
      if (userError || !user) throw new Error("User not found");

      let avatarDbValue = profile.avatar_path || ""; // existing stored path
      let finalDisplayUrl = profile.avatar_url || "";

      // If user selected a new file, upload to storage now
      if (selectedFile) {
        setUploading(true);
        const { filePath, displayUrl } = await uploadFileToStorage(selectedFile, user.id);
        avatarDbValue = filePath; // store storage path in DB
        finalDisplayUrl = displayUrl || "";
        setUploading(false);
      }

      // Build upsert payload: ensure social fields are present
      const { account_email, ...profileData } = profile;
      const safeData = Object.fromEntries(
        Object.entries(profileData).map(([k, v]) => {
          // keep strings (empty -> empty string) to avoid nulls unless you prefer nulls
          return [k, v ?? ""];
        })
      );

      const updates = {
        id: user.id,
        ...safeData,
        account_email: user.email,
        updated_at: new Date(),
        avatar_url: avatarDbValue,
        // social fields already included in safeData (facebook, instagram, github, linkedin)
      };

      const { error: upsertErr } = await supabase.from("settings").upsert(updates, { onConflict: ["id"] });
      if (upsertErr) throw upsertErr;

      // Update UI: display the just-uploaded image (or previously existing)
      const updatedProfile = {
        ...profile,
        avatar_path: avatarDbValue,
        avatar_url: finalDisplayUrl,
        facebook: updates.facebook ?? profile.facebook,
        instagram: updates.instagram ?? profile.instagram,
        github: updates.github ?? profile.github,
        linkedin: updates.linkedin ?? profile.linkedin
      };
      setProfile(updatedProfile);
      // update last saved profile snapshot
      lastSavedProfileRef.current = updatedProfile;

      // notify other open pages (e.g. UsersProfile) so they update immediately without refresh
      try {
        window.dispatchEvent(new CustomEvent('profile-updated', {
          detail: {
            id: user.id,
            avatar_url: finalDisplayUrl || '',
            first_name: updatedProfile.first_name || '',
            last_name: updatedProfile.last_name || '',
            display_name: updatedProfile.display_name || `${updatedProfile.first_name || ''} ${updatedProfile.last_name || ''}`.trim()
          }
        }));
      } catch (e) { /* ignore dispatch errors */ }
      setSelectedFile(null);
      setSelectedPreview(null);

      setSuccess("Saved!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  // Cancel handler: restore last saved profile, clear selected preview/file, reset passwords and alerts
  const handleCancel = () => {
    const saved = lastSavedProfileRef.current || defaultProfile;
    setProfile(saved);
    setSelectedFile(null);
    setSelectedPreview(null);
    setPasswords({ current: "", newPass: "", confirm: "" });
    setSuccess("");
    setError("");
  };

  const handlePasswordUpdate = async () => {
    setError("");
    setSuccess("");
    if (passwords.newPass !== passwords.confirm) {
      setError("New password and confirm password do not match.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: passwords.newPass });
    if (error) setError("Password update failed: " + error.message);
    else {
      setSuccess("Password updated!");
      setPasswords({ current: "", newPass: "", confirm: "" });
      setTimeout(() => setSuccess(""), 2000);
    }
  };

  const handleGoogleConnect = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
    if (error) setError("Google connect failed: " + error.message);
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  // prefer selected preview (not yet uploaded) for immediate feedback,
  // otherwise show profile.avatar_url (display url) or defaultAvatar
  const avatarSrc = selectedPreview || profile.avatar_url || defaultAvatar;

  const handleDeleteAccount = async (confirmedEmail) => {
    if (!confirmedEmail) throw new Error('Email confirmation required');

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not found');
    if (confirmedEmail !== user.email) throw new Error('Email confirmation failed');

    try {
      // First delete storage items
      if (profile?.avatar_path && !profile.avatar_path.startsWith('http')) {
        await supabase.storage
          .from('avatars')
          .remove([profile.avatar_path]);
      }

      // Call the delete_user function
      const { error: deleteError } = await supabase.rpc('delete_user', {
        user_id: user.id
      });

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw new Error(deleteError.message);
      }

      // Sign out after successful deletion
      await supabase.auth.signOut();
      
      // Navigate away
      window.location.href = '/';
      
    } catch (error) {
      console.error('Delete failed:', error);
      throw new Error(`Account deletion failed: ${error.message}`);
    }
  };

  // Replace the delete account button click handler
  const onDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="settings-root">
      <aside className="settings-sidebar">
        <nav className="sidebar-list">
          <div className="sidebar-item active" onClick={() => handleSidebarClick(basicRef)}>Basic Information</div>
          <div className="sidebar-item" onClick={() => handleSidebarClick(bioRef)}>Bio</div>
          <div className="sidebar-item" onClick={() => handleSidebarClick(teamsRef)}>Teams</div>
          <div className="sidebar-item" onClick={() => handleSidebarClick(linksRef)}>Links</div>
          <div className="sidebar-item" onClick={() => handleSidebarClick(accountRef)}>Account Settings</div>
          <div className="sidebar-item logout" onClick={handleLogout}>Logout</div>
          <div 
            className="sidebar-item delete-account"
            onClick={onDeleteClick}
            role="button"
            tabIndex={0}
            aria-label="Delete account"
          >
            Delete account
          </div>
        </nav>
      </aside>

      <main className="settings-main">
        {success && <div className="alert success">{success}</div>}
        {error && <div className="alert error">{error}</div>}

        <form onSubmit={handleSave}>
          <section className="settings-card" ref={basicRef}>
            <div className="card-header"><span className="card-title">BASIC INFORMATION</span></div>
            <div className="basic-info-content">
              <div className="avatar-section">
                <div className="avatar-img">
                  <label htmlFor="avatarInput" className="avatar-dropzone" title="Click to upload / drag & drop">
                    <input
                      id="avatarInput"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      style={{ display: "none" }}
                    />
                    <img
                      src={selectedPreview || profile.avatar_url || defaultAvatar}
                      alt="avatar"
                      className="avatar-preview"
                      onError={(e) => { e.currentTarget.src = defaultAvatar; }}
                    />
                    <div className="drop-overlay">
                      <span>{uploading ? "Uploading..." : "Change"}</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="basic-fields">
                <div className="fields-row">
                  <div className="field-group">
                    <label>First Name</label>
                    <input type="text" name="first_name" value={profile.first_name} onChange={handleChange} placeholder="Enter your first name" />
                  </div>
                  <div className="field-group">
                    <label>Last Name</label>
                    <input type="text" name="last_name" value={profile.last_name} onChange={handleChange} placeholder="Enter your last name" />
                  </div>
                </div>
                <div className="field-group">
                  <label>Year Level</label>
                  <input type="text" name="year_level" value={profile.year_level} onChange={handleChange} placeholder="e.g. 3rd Year" />
                </div>
                <div className="field-group">
                  <label>Batch</label>
                  <input type="text" name="batch" value={profile.batch} onChange={handleChange} placeholder="e.g. Batch 2025" />
                </div>
                <div className="field-group">
                  <label>Address</label>
                  <input type="text" name="address" value={profile.address} onChange={handleChange} placeholder="Enter your address" />
                </div>
                <div className="field-group">
                  <label>Portfolio URL</label>
                  <input type="text" name="portfolio_url" value={profile.portfolio_url} onChange={handleChange} placeholder="https://yourportfolio.com" className="optional" />
                </div>
              </div>
            </div>
          </section>

          <section className="settings-card" ref={bioRef}>
            <div className="card-header"><span className="card-title">BIO</span></div>
            <div className="field-group">
              <label>About Me</label>
              <textarea name="bio" value={profile.bio} onChange={handleChange} rows={4} placeholder="Tell us something about yourself..." />
            </div>
          </section>

          {/* Links section */}
          <section className="settings-card" ref={linksRef}>
            <div className="card-header"><span className="card-title">LINKS</span></div>
            <div className="links-content">
              <p className="links-desc">Connected Accounts — Build trust with your network by connecting your social profiles</p>

              <div className="field-group">
                <label>Facebook</label>
                <input type="url" name="facebook" value={profile.facebook} onChange={handleChange} placeholder="https://facebook.com/yourprofile" />
              </div>

              <div className="field-group">
                <label>Instagram</label>
                <input type="url" name="instagram" value={profile.instagram} onChange={handleChange} placeholder="https://instagram.com/yourprofile" />
              </div>

              <div className="field-group">
                <label>GitHub</label>
                <input type="url" name="github" value={profile.github} onChange={handleChange} placeholder="https://github.com/yourprofile" />
              </div>

              <div className="field-group">
                <label>LinkedIn</label>
                <input type="url" name="linkedin" value={profile.linkedin} onChange={handleChange} placeholder="https://linkedin.com/in/yourprofile" />
              </div>
            </div>
          </section>

          <section className="settings-card" ref={accountRef}>
            <div className="card-header"><span className="card-title">ACCOUNT SETTINGS</span></div>
            <div className="field-group">
              <label>Username</label>
              <input type="text" name="username" value={profile.username} onChange={handleChange} placeholder="Choose a username" />
            </div>
            <div className="field-group">
              <label>Account Email</label>
              <input type="email" name="account_email" value={profile.account_email} readOnly />
            </div>

            <div className="field-group password-group">
              <label>New Password</label>
              <input type="password" name="newPass" value={passwords.newPass} onChange={handlePasswordChange} placeholder="New Password" />
            </div>
            <div className="field-group password-group">
              <label>Confirm Password</label>
              <input type="password" name="confirm" value={passwords.confirm} onChange={handlePasswordChange} placeholder="Confirm Password" />
            </div>
            <button type="button" className="save-changes-btn" onClick={handlePasswordUpdate}>Update Password</button>

            <div className="field-group">
              <label>Google Sign-in</label>
              <button type="button" className="google-btn" onClick={handleGoogleConnect}>Connect Google</button>
            </div>

            <div className="actions-row">
             <button className="cancel-btn" type="button" disabled={loading}>Cancel</button>
              <button className="save-changes-btn" type="submit" disabled={loading || uploading}>{(loading || uploading) ? "Saving..." : "Save Changes"}</button>
            </div>
          </section>
        </form>

        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteAccount}
          email={profile?.account_email}
        />
      </main>
    </div>
  );
}