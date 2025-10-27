import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const [session, setSession] = useState(undefined);

  // Sign up
  const signUpNewUser = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password: password,
    });
    if (error) {
      console.error("Error signing up: ", error);
      throw error;
    }
    return data;
  };

  // Sign in
  const signInUser = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password,
    });
    if (error) {
      console.error("Sign-in error:", error.message);
      throw error;
    }
    console.log("Sign-in success:", data);
    return data;
  };

  // Google Sign-In
  const googleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://example.com/auth/callback', // Change this to your redirect URL
      },
    });
    if (error) {
      throw error;
    }
    return data;
  };

  const facebookSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: 'http://example.com/auth/callback', // Change this to your redirect URL
      },
    });
    if (error) {
      throw error;
    }
    return data;
  };
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  // Sign out
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
  }
  
  // Here, you need to include all the functions you want to share
  return (
    <AuthContext.Provider
      value={{
        signUpNewUser, // Make sure this is included
        signInUser, // Make sure this is included
        googleSignIn,
        facebookSignIn,
        signOut,
        session, // You might also want to expose the session
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const UserAuth = () => {
  return useContext(AuthContext);
};