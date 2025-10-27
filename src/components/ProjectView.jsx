import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ProjectView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select(`
            *,
            profiles:user_id (
              username,
              avatar_url,
              firstname,
              lastname
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        setProject(data);
      } catch (err) {
        console.error('Error fetching project:', err);
        navigate('/homepage'); // Redirect to homepage if there's an error
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id, navigate]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!project) return <div className="p-8 text-center">Project not found</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="relative h-96">
          <img 
            src={project.thumbnail_display || project.image_url} 
            alt={project.title}
            className="w-full h-full object-cover"
          />
          <button 
            onClick={() => navigate('/homepage')}
            className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-lg"
          >
            ← Back
          </button>
        </div>

        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <img
              src={project.profiles?.avatar_url || '/default-avatar.png'}
              alt="Creator"
              className="w-12 h-12 rounded-full"
            />
            <div>
              <h1 className="text-2xl font-bold">{project.title}</h1>
              <p className="text-gray-600">
                By {project.profiles?.firstname} {project.profiles?.lastname}
              </p>
            </div>
          </div>

          <div className="prose max-w-none">
            <p className="text-lg leading-relaxed">{project.description}</p>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            Posted on {new Date(project.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectView;