import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { FilmCard } from '../App.tsx';
import { deleteProject, fetchProfile, type ProfileData } from '../data.tsx';

export default function Profile() {
  const { user, isLoaded } = useUser();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingProjectId, setWorkingProjectId] = useState('');

  const username = (user?.username ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? user?.id ?? '').trim().toLowerCase();
  const displayName = profile?.FULL_NAME || user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || username;
  const email = profile?.EMAIL || user?.primaryEmailAddress?.emailAddress || '';

  const ownedProjectIds = new Set(profile?.PROJECTS?.map((project) => project.ID) ?? []);

  const handleDeleteProject = async (projectId: string) => {
    const project = profile?.PROJECTS?.find((entry) => entry.ID === projectId);
    if (!project) {
      return;
    }

    if (!window.confirm(`Delete ${project.NAME}? This cannot be undone.`)) {
      return;
    }

    try {
      setWorkingProjectId(projectId);
      setError('');
      await deleteProject(projectId, {
        OWNER_USERNAME: username,
        OWNER_EMAIL: email,
      });
      setProfile((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          PROJECTS: current.PROJECTS.filter((entry) => entry.ID !== projectId),
        };
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete project');
    } finally {
      setWorkingProjectId('');
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!username) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await fetchProfile(username);
        setProfile(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [username]);

  if (!isLoaded || loading) {
    return <div className='profile-page-wrapper'>Loading profile...</div>;
  }

  return (
    <div className='profile-page-wrapper'>
      <section className='profile-hero'>
        <p className='profile-kicker'>Profile</p>
        <h1>{displayName}</h1>
        <div className='profile-meta'>
          <span>{username || 'Username unavailable'}</span>
          {email && <span>{email}</span>}
        </div>
      </section>

      {error && <p>{error}</p>}

      <section className='profile-projects'>
        <div className='projects-header'>
          <h2 className='projects-header-title'>Owned Projects</h2>
        </div>
        <div className='projects'>
          {profile?.PROJECTS?.length ? profile.PROJECTS.map((project) => (
            <div key={project.ID} className='owned-project-card'>
              <FilmCard
                FILMID={project.ID}
                NAME={project.NAME}
                DATES={project.DATES}
                DESCRIPTION={project.DESCRIPTION}
                ROLES={project.ROLES}
              />
              {ownedProjectIds.has(project.ID) && (
                <div className='owned-project-actions'>
                  <button
                    type='button'
                    className='create-project-button'
                    onClick={() => handleDeleteProject(project.ID)}
                    disabled={workingProjectId === project.ID}
                  >
                    {workingProjectId === project.ID ? 'Working...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          )) : <p>No projects found for this Clerk account.</p>}
        </div>
      </section>
    </div>
  );
}
