import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchData, type ProjectData } from '../data.tsx';

export default function Film() {
  const { FILMID } = useParams();
  const [film, setFilm] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFilm = async () => {
      if (!FILMID) {
        setLoading(false);
        return;
      }

      try {
        const projects = await fetchData();
        const selectedFilm = projects.find((data) => data.ID === FILMID) ?? null;
        setFilm(selectedFilm);
      } finally {
        setLoading(false);
      }
    };

    loadFilm();
  }, [FILMID]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!film) {
    return <div>Film not found.</div>;
  }
  
  return (
    <>
      <div className="film-page-wrapper">
        <h2 className='film-title'>
          {film.NAME}
        </h2>
        <h5 className='film-dates'>
          {film.DATES}
        </h5>
        <p className='film-details'>
          {film.DESCRIPTION}
        </p>
        <section className='creator-box'>
          <h4>Creator</h4>
          <p><strong>Username:</strong> {film.CREATOR_USERNAME || film.USER_ID}</p>
          <p><strong>Full name:</strong> {film.CREATOR_FULL_NAME || 'Not available'}</p>
          <button
            type='button'
            className='create-project-button'
            onClick={() => {
              if (film.CREATOR_EMAIL) {
                window.location.href = `mailto:${film.CREATOR_EMAIL}`;
              }
            }}
            disabled={!film.CREATOR_EMAIL}
          >
            {film.CREATOR_EMAIL ? 'Email Creator' : 'Email unavailable'}
          </button>
        </section>
        <section className='roles-box'>
          <h4>Needed Roles</h4>
          {film.ROLES.length > 0 ? (
            <div className='roles-list'>
              {film.ROLES.map((role) => (
                <span key={role} className='role-pill'>{role}</span>
              ))}
            </div>
          ) : (
            <p>No roles selected.</p>
          )}
        </section>
      </div>
    </>
  );
}

// Add: Contact, Tags