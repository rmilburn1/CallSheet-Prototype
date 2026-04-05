import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { FilmCard } from '../App.tsx';
import { fetchProfile, type ProfileData } from '../data.tsx';

export default function Profile() {
  const { user, isLoaded } = useUser();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const username = (user?.username ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? user?.id ?? '').trim().toLowerCase();
  const displayName = profile?.FULL_NAME || user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || username;
  const email = profile?.EMAIL || user?.primaryEmailAddress?.emailAddress || '';

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
            <FilmCard
              key={project.ID}
              FILMID={project.ID}
              NAME={project.NAME}
              DATES={project.DATES}
              DESCRIPTION={project.DESCRIPTION}
              ROLES={project.ROLES}
            />
          )) : <p>No projects found for this Clerk account.</p>}
        </div>
      </section>
    </div>
  );
}
