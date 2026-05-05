import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { FilmCard } from '../App.tsx';
import { deleteProject, fetchProfile, fetchRoles, updateProfile, type ProfileData, type RoleData } from '../data.tsx';

export default function Profile() {
  const { user, isLoaded } = useUser();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingProjectId, setWorkingProjectId] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [allRoles, setAllRoles] = useState<RoleData[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const username = (user?.username ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? user?.id ?? '').trim().toLowerCase();
  const displayName = profile?.FULL_NAME || user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || username;
  const email = profile?.EMAIL || user?.primaryEmailAddress?.emailAddress || '';
  const isOwner = username && username === (profile?.USERNAME ?? '').toLowerCase();

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
        setBio(response.BIO ?? '');
        setSocials(response.SOCIAL_LINKS ?? {});
        setSelectedRoleIds(new Set(response.INTERESTED_ROLES?.map((role) => role.ID) ?? []));

        try {
          const roles = await fetchRoles();
          setAllRoles(roles);
        } catch {
          // Ignore role loading errors so the profile still renders.
        }
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

        <h3>About</h3>
        <p>{profile?.BIO ?? 'No bio provided.'}</p>

        <h3>Interested Roles</h3>
        <div className='roles-list'>
          {profile?.INTERESTED_ROLES && profile.INTERESTED_ROLES.length ? (
            profile.INTERESTED_ROLES.map((role) => (
              <span key={role.ID} className='role-pill'>
                {role.TITLE}
              </span>
            ))
          ) : (
            <p>No roles selected.</p>
          )}
        </div>
      </section>

      {error && <p>{error}</p>}

      <section className='profile-projects'>
        {isOwner && (
          <div>
            <div className='profile-editor-toggle'>
              <button className='create-project-button' type='button' onClick={() => setEditOpen((value) => !value)}>
                {editOpen ? 'Hide Editor' : 'Edit Profile'}
              </button>
            </div>

            {editOpen && (
              <div className='create-project-form profile-edit'>
                <h2>About</h2>
                <textarea
                  className='create-project-textarea create-project-input'
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder='Write a short bio'
                  rows={4}
                />

                <h3>Interested Roles</h3>
                <div className='role-picker'>
                  <div className='role-picker-grid'>
                    {allRoles.map((role) => {
                      const selected = selectedRoleIds.has(role.ID);

                      return (
                        <label key={role.ID} className={`role-chip ${selected ? 'role-chip-selected' : ''}`}>
                          <input
                            className='role-input'
                            type='checkbox'
                            checked={selected}
                            onChange={(e) => {
                              const next = new Set(selectedRoleIds);
                              if (e.target.checked) {
                                next.add(role.ID);
                              } else {
                                next.delete(role.ID);
                              }
                              setSelectedRoleIds(next);
                            }}
                          />
                          {role.TITLE}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className='profile-save'>
                  <button
                    className='create-project-button'
                    type='button'
                    disabled={saving}
                    onClick={async () => {
                      if (!username) {
                        return;
                      }

                      setSaving(true);
                      setError('');

                      try {
                        await updateProfile(
                          username,
                          {
                            BIO: bio,
                            SOCIAL_LINKS: socials,
                            INTERESTED_ROLE_IDS: Array.from(selectedRoleIds).map((id) => Number(id)),
                          },
                          username,
                          email,
                        );
                        const refreshed = await fetchProfile(username);
                        setProfile(refreshed);
                      } catch (saveErr) {
                        setError(saveErr instanceof Error ? saveErr.message : 'Failed to save profile');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className='projects-header'>
          <h2 className='projects-header-title'>Owned Projects</h2>
        </div>
        <div className='projects'>
          {profile?.PROJECTS?.length ? (
            profile.PROJECTS.map((project) => (
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
            ))
          ) : (
            <p>No projects found for this Clerk account.</p>
          )}
        </div>
      </section>
    </div>
  );
}
