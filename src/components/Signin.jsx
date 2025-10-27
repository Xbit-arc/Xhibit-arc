import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient"; // <- import supabase
import "./Signin.css";
import XhibitLogo from '../assets/XhibitLogo.png';
import GoggleIcon from '../assets/google.png';
import FacebookIcon from '../assets/facebook.png';

const Signin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const { signInUser, googleSignIn, facebookSignIn } = UserAuth();
  const navigate = useNavigate();

  // Helper function to fetch user profile from `settings`
  const fetchProfile = async (userId) => {
    const { data: profileData, error: profileError } = await supabase
      .from("settings")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Failed to fetch profile:", profileError.message);
      return null;
    }

    // Store profile in localStorage (or use context in your app)
    localStorage.setItem("userProfile", JSON.stringify(profileData));
    return profileData;
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      const { data: authData, error: authError } = await signInUser(email, password);
      if (authError) throw authError;

      // fetch profile after login
      if (authData?.user?.id) {
        await fetchProfile(authData.user.id);
      }

      navigate("/dashboard");
    } catch (e) {
      setError("Invalid Email or Password!");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { data: authData, error: authError } = await googleSignIn();
      if (authError) throw authError;

      if (authData?.user?.id) {
        await fetchProfile(authData.user.id);
      }

      navigate("/dashboard");
    } catch (e) {
      setError("Credentials invalid");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      const { data: authData, error: authError } = await facebookSignIn();
      if (authError) throw authError;

      if (authData?.user?.id) {
        await fetchProfile(authData.user.id);
      }

      navigate("/dashboard");
    } catch (e) {
      setError("Credentials invalid");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div className="login-bg">
      <div className="logo-section">
        <img src={XhibitLogo} alt="Xhibit Logo" className="logo" />
      </div>
      <div className="signin-card">
        <h2 className="signin-title">Sign in</h2>
        {error && <div className="signin-error-top">{error}</div>}
        <div className="signin-newuser-row">
          <span className="signin-newuser-text">New user?</span>
          <Link to="/signup" className="signin-link">
            Create an account
          </Link>
        </div>
        <form onSubmit={handleSignIn}>
          <div className="signin-input-group">
            <label htmlFor="email" className="signin-label">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="signin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
          </div>
          <div className="signin-input-group">
            <label htmlFor="password" className="signin-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                className="signin-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
              <button
                type="button"
                className="toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            <div className="signin-forgot">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          </div>
          <button className="signin-continue-btn" type="submit">
            Continue
          </button>
        </form>
        <div className="signin-or">Or</div>
        <div className="signin-socials">
          <button
            className="signin-social-btn google"
            type="button"
            onClick={handleGoogleSignIn}
          >
            <img
              src={GoggleIcon}
              alt="Google"
              className="signin-social-icon"
            />
            Continue with Google
          </button>
          <button
            className="signin-social-btn facebook"
            type="button"
            onClick={handleFacebookSignIn}
          >
            <img
              src={FacebookIcon}
              alt="Facebook"
              className="signin-social-icon"
            />
            Continue with Facebook
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signin;
