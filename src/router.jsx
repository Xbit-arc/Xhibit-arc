import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Signup from "./components/Signup";
import Signin from "./components/Signin";
import Dashboard from "./routes/Dashboard";
import PrivateRoute from "./components/PrivateRoute";
import Homepage from "./routes/Homepage";
import Upload from "./routes/Upload";
import UsersProfile from "./routes/UsersProfile";
import Layout from "./components/Layout";
import Settings from "./routes/Settings";
import Communities from "./routes/Communities";
import ProjectDetails from './components/ProjectDetails';
import FollowingPage from './routes/FollowingPage';

export const router = createBrowserRouter([
  { path: "signup", element: <Signup /> },
  { path: "signin", element: <Signin /> },
  {
    path: "/",
    element: (
      <PrivateRoute>
        <Layout />
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <App /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "homepage", element: <Homepage /> },
      { path: "upload", element: <Upload /> },

      // keep both routes: without id (current user) and with :id (view other users)
      { path: "usersprofile", element: <UsersProfile /> },
      { path: "usersprofile/:id", element: <UsersProfile /> },

      { path: "settings", element: <Settings /> },
      { path: "communities", element: <Communities /> },
      { path: "project/:id", element: <ProjectDetails /> },
      { path: "follow", element: <FollowingPage /> },
    ],
  },
]);