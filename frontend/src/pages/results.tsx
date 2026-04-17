import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilmCard } from '../App.tsx'
import { fetchData, fetchProfile, type ProfileData, type ProjectData } from '../data.tsx';

export default function Results() {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<ProjectData[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const query = searchParams.get('q') ?? '';
  const searchType = (searchParams.get('type') ?? 'project') as 'project' | 'profile' | 'roles';

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        setError('');
        if (searchType === 'profile') {
          setResults([]);
          const data = await fetchProfile(query);
          setProfile(data);
        } else {
          setProfile(null);
          const data = await fetchData(query, searchType);
          setResults(data);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [query, searchType]);

  return (
    <>
    <div className='search-results-wrapper'>
      <h1>
        {searchType === 'profile'
          ? 'Profile Search Results'
          : searchType === 'roles'
            ? 'Role Search Results'
            : 'Project Search Results'}
        {query ? ` for "${query}"` : ''}
      </h1>
      {loading && <p>Searching...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && searchType === 'profile' && !profile && <p>No profile found.</p>}
      {!loading && !error && searchType !== 'profile' && results.length === 0 && <p>{searchType === 'roles' ? 'No matching films found.' : 'No matching projects found.'}</p>}
      {!loading && !error && searchType === 'profile' && profile && (
        <div className='profile-page-wrapper'>
          <section className='profile-hero'>
            <p className='profile-kicker'>Profile</p>
            <h1>{profile.FULL_NAME || profile.USERNAME}</h1>
            <div className='profile-meta'>
              <span>{profile.USERNAME}</span>
              {profile.EMAIL && <span>{profile.EMAIL}</span>}
            </div>
          </section>

          <section className='profile-projects'>
            <div className='projects-header'>
              <h2 className='projects-header-title'>Owned Projects</h2>
            </div>
            <div className='projects'>
              {profile.PROJECTS.length ? profile.PROJECTS.map((project) => (
                <FilmCard
                  key={project.ID}
                  FILMID={project.ID}
                  NAME={project.NAME}
                  DATES={project.DATES}
                  DESCRIPTION={project.DESCRIPTION}
                  ROLES={project.ROLES}
                />
              )) : <p>No projects found for this profile.</p>}
            </div>
          </section>
        </div>
      )}
      {!loading && !error && searchType !== 'profile' && (
        <div className='projects'>
          {results.map((data, key) => (
            <FilmCard
              key={key}
              FILMID={data.ID}
              NAME={data.NAME}
              DATES={data.DATES}
              DESCRIPTION={data.DESCRIPTION}
              ROLES={data.ROLES}
            />
          ))}
        </div>
      )}
    </div>
    </>
    
  );
}