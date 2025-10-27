import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import XhibitLogo from '../assets/XhibitLogo.png';
import GoggleIcon from '../assets/google.png';
import FacebookIcon from '../assets/facebook.png';
import "./Signup.css";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reEnterPassword, setReEnterPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showReEnterPassword, setShowReEnterPassword] = useState(false);

  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== reEnterPassword) {
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }

    try {
      // 1️⃣ Sign up user with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // 2️⃣ Create a default settings row for this new user
      if (authData?.user?.id) {
        const { error: settingsError } = await supabase.from("settings").insert([
          {
            id: authData.user.id, // link settings row to user id
            first_name: "",
            last_name: "",
            year_level: "",
            batch: "",
            address: "",
            portfolio_url: "",
            bio: "",
            username: "",
            updated_at: new Date()
          }
        ]);

        if (settingsError) {
          console.error("Failed to create profile:", settingsError.message);
        }
      }

      navigate("/dashboard");
    } catch (err) {
      setError("An unexpected error occurred.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google" });
      if (error) throw error;

      // Create settings row for first-time Google login
      if (data?.user?.id) {
        const { data: existing, error: checkError } = await supabase
          .from("settings")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (checkError || !existing) {
          await supabase.from("settings").insert([
            {
              id: data.user.id,
              first_name: "",
              last_name: "",
              year_level: "",
              batch: "",
              address: "",
              portfolio_url: "",
              bio: "",
              username: "",
              updated_at: new Date()
            }
          ]);
        }
      }

      navigate("/dashboard");
    } catch (e) {
      setError("Google sign in failed.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleFacebookSignIn = async () => {
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: "facebook" });
      if (error) throw error;

      // Create settings row for first-time Facebook login
      if (data?.user?.id) {
        const { data: existing, error: checkError } = await supabase
          .from("settings")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (checkError || !existing) {
          await supabase.from("settings").insert([
            {
              id: data.user.id,
              first_name: "",
              last_name: "",
              year_level: "",
              batch: "",
              address: "",
              portfolio_url: "",
              bio: "",
              username: "",
              updated_at: new Date()
            }
          ]);
        }
      }

      navigate("/dashboard");
    } catch (e) {
      setError("Facebook sign in failed.");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div className="signup-bg">
      <div className="logo-section">
        <img src={XhibitLogo} alt="Xhibit Logo" className="logo" />
      </div>
      <div className="signup-card">
        <h2 className="signup-title">Create an account?</h2>
        {error && (
          <div className="signup-error-top">{error}</div>
        )}
        <form onSubmit={handleSignUp}>
          <div className="signup-input-group">
            <label htmlFor="email" className="signup-label">Email</label>
            <input
              type="email"
              id="email"
              className="signup-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
          </div>
          <div className="signup-input-group">
            <label htmlFor="password" className="signup-label">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                className="signup-input"
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
          </div>
          <div className="signup-input-group">
            <label htmlFor="re-enter-password" className="signup-label">Re-enter password</label>
            <div className="password-input-container">
              <input
                type={showReEnterPassword ? "text" : "password"}
                id="re-enter-password"
                className="signup-input"
                value={reEnterPassword}
                onChange={(e) => setReEnterPassword(e.target.value)}
                placeholder="Re-enter password"
                required
              />
              <button
                type="button"
                className="toggle-password-visibility"
                onClick={() => setShowReEnterPassword(!showReEnterPassword)}
              >
                {showReEnterPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <button type="submit" className="signup-continue-btn" disabled={loading}>
            {loading ? "Creating account..." : "Continue"}
          </button>
        </form>
        <div className="signup-or">Or</div>
        <div className="signup-socials">
          <button
            className="signup-social-btn google"
            type="button"
            onClick={handleGoogleSignIn}
          >
            <img
              src={GoggleIcon}
              alt="Google"
              className="signup-social-icon"
            />
            Continue with Google
          </button>
          <button
            className="signup-social-btn facebook"
            type="button"
            onClick={handleFacebookSignIn}
          >
            <img
              src={FacebookIcon}
              alt="Facebook"
              className="signup-social-icon"
            />
            Continue with Facebook
          </button>
        </div>
        <div className="signup-login-link-row">
          <span className="signup-login-text">Already have an account?</span>
          <Link to="/signin" className="signup-login-link">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
