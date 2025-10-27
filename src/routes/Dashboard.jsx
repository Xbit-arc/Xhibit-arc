import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { session, signOut } = UserAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null); 

  const handleSignOut = async (e) => {
    e.preventDefault();

    try {
      await signOut();
      navigate("/");
    } catch (err) {
      setError("An unexpected error occurred.");
    }
  };

  console.log(session);

  return (
    <div>
      <div style={{ marginTop: "100px", textAlign: "center" }}>
        <h1>Welcome to Exibit!</h1>
        <p>Discover projects, connect with people, and share your ideas.</p>
      </div>
      <p
        onClick={handleSignOut}
        className="hover:cursor-pointer border inline-block px-4 py-3 mt-4"
      >
        Sign out
      </p>
      {error && (
        <p className="text-red-600 text-center pt-4">{error}</p>
      )}
    </div>
  );
};

export default Dashboard;