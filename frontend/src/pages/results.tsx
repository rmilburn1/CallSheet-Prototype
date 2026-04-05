import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilmCard } from '../App.tsx'
import { fetchData, type ProjectData } from '../data.tsx';

export default function Results() {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const query = searchParams.get('q') ?? '';
  const searchType = (searchParams.get('type') ?? 'project') as 'project' | 'profile';

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await fetchData(query, searchType);
        setResults(data);
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
      <h1>{searchType === 'profile' ? 'Profile Search Results' : 'Project Search Results'}{query ? ` for "${query}"` : ''}</h1>
      {loading && <p>Searching...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && results.length === 0 && <p>No matching projects found.</p>}
      <div className='projects'>
                {!loading && !error && results.map((data, key) => (
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
    </div>
    </>
    
  );
}