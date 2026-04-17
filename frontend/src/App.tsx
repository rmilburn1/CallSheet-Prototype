import { type FormEvent, useEffect, useRef, useState } from 'react';
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import bookmarkIcon from './assets/Bookmark.svg'
import dropdownIcon from './assets/Chevron down.svg'
import goIcon from './assets/Corner up-right.svg'
import editIcon from './assets/Edit.svg'
import gridIcon from './assets/Grid.svg'
import listIcon from './assets/List.svg'
import moonIcon from './assets/Moon.svg'
import plusIcon from './assets/Plus.svg'
import searchIcon from './assets/Search.svg'
import sunIcon from './assets/Sun.svg'

// add light counterparts (rename paths if your filenames differ)
import bookmarkIconLight from './assets/light_icons/Bookmark.svg'
import dropdownIconLight from './assets/light_icons/Chevron down.svg'
import goIconLight from './assets/light_icons/Corner up-right.svg'
import editIconLight from './assets/light_icons/Edit.svg'
import gridIconLight from './assets/light_icons/Grid.svg'
import listIconLight from './assets/light_icons/List.svg'
import moonIconLight from './assets/light_icons/Moon.svg'
import plusIconLight from './assets/light_icons/Plus.svg'
import searchIconLight from './assets/light_icons/Search.svg'
import sunIconLight from './assets/light_icons/Sun.svg'

import { createProject, fetchData, fetchRoles, syncClerkUser, type ProjectData, type RoleData } from './data.tsx'
import { SignedIn, SignedOut, SignIn, UserButton, useUser } from '@clerk/clerk-react';

import { Route, Routes, useNavigate } from "react-router-dom";
import Login from "./pages/login";
import Film from "./pages/film";
import Results from "./pages/results";
import Profile from "./pages/profile.tsx";

import './App.css'

type Theme = 'light' | 'dark';

type ThemeIcons = {
  bookmark: string;
  dropdown: string;
  go: string;
  edit: string;
  grid: string;
  list: string;
  moon: string;
  plus: string;
  search: string;
  sun: string;
};

const iconsByTheme: Record<Theme, ThemeIcons> = {
  light: {
    bookmark: bookmarkIcon,
    dropdown: dropdownIcon,
    go: goIcon,
    edit: editIcon,
    grid: gridIcon,
    list: listIcon,
    moon: moonIcon,
    plus: plusIcon,
    search: searchIcon,
    sun: sunIcon,
  },
  dark: {
    bookmark: bookmarkIconLight,
    dropdown: dropdownIconLight,
    go: goIconLight,
    edit: editIconLight,
    grid: gridIconLight,
    list: listIconLight,
    moon: moonIconLight,
    plus: plusIconLight,
    search: searchIconLight,
    sun: sunIconLight,
  },
};

function App() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const icons = iconsByTheme[theme];
  const lastSyncedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      return;
    }

    if (lastSyncedUserId.current === user.id) {
      return;
    }

    const username = (user.username ?? user.primaryEmailAddress?.emailAddress?.split('@')[0] ?? user.id ?? '').trim().toLowerCase();
    const email = (user.primaryEmailAddress?.emailAddress ?? '').trim().toLowerCase();

    const syncUser = async () => {
      try {
        await syncClerkUser({
          USERNAME: username,
          EMAIL: email,
          FIRST_NAME: user.firstName ?? '',
          LAST_NAME: user.lastName ?? '',
          FULL_NAME: user.fullName ?? '',
        });
        lastSyncedUserId.current = user.id;
      } catch {
        // Fail silently to avoid blocking login UX if sync is temporarily unavailable.
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, user]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  };

  return (
    <>
      <SignedOut>
        <SignIn />
      </SignedOut>
      <SignedIn>
        <Navbar onThemeToggle={toggleTheme} currentTheme={theme} icons={icons}/>
        <div className='app-content'>
          <Routes>
            <Route path="/" element={<Home icons={icons}/>} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/film/:FILMID" element={<Film />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </div>
      </SignedIn>
    </>
  )
  /* return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  ) */
}

function Home({ icons }: { icons: ThemeIcons }) {
  const { user } = useUser();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [dates, setDates] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const ownerUsername = (user?.username ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? user?.id ?? '').trim().toLowerCase();
  const ownerEmail = (user?.primaryEmailAddress?.emailAddress ?? '').trim().toLowerCase();
  const ownerFirstName = user?.firstName ?? '';
  const ownerLastName = user?.lastName ?? '';
  const ownerFullName = (user?.fullName ?? [ownerFirstName, ownerLastName].filter(Boolean).join(' ')).trim();

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetchData();
        setProjects(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await fetchRoles();
        setRoles(response);
      } catch {
        setRoles([]);
      }
    };

    loadRoles();
  }, []);

  useEffect(() => {
    if (!showCreateForm) {
      setSelectedRoleIds([]);
    }
  }, [showCreateForm]);

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !dates.trim() || !description.trim()) {
      return;
    }

    try {
      setIsCreating(true);
      setError('');
      const created = await createProject({
        NAME: name.trim(),
        DATES: dates.trim(),
        DESCRIPTION: description.trim(),
        USER_ID: ownerUsername,
        OWNER_USERNAME: ownerUsername,
        OWNER_EMAIL: ownerEmail,
        OWNER_FIRST_NAME: ownerFirstName,
        OWNER_LAST_NAME: ownerLastName,
        ROLE_IDS: selectedRoleIds,
      });
      setProjects((prev) => [created, ...prev]);
      setName('');
      setDates('');
      setDescription('');
      setShowCreateForm(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const yourProjects = projects.filter((project) => {
    const projectOwner = (project.USER_ID ?? '').trim().toLowerCase();
    return projectOwner === ownerUsername || projectOwner === ownerEmail || projectOwner === ownerFullName.toLowerCase();
  });

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((previous) => (
      previous.includes(roleId)
        ? previous.filter((selectedRoleId) => selectedRoleId !== roleId)
        : [...previous, roleId]
    ));
  };

  const navigate = useNavigate();

  return (
    <>
      {showCreateForm && (
        <div className='create-project-overlay' onClick={() => setShowCreateForm(false)}>
          <form
            className='create-project-form'
            onSubmit={handleCreateSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <h4>Create a New Project</h4>
            <div className='creator-summary'>
              <p className='creator-summary-label'>Posting as <strong>{ownerUsername || 'Signed-in Clerk user'}</strong></p>
            </div>
            <input
              className='create-project-input'
              placeholder='Project Name'
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              className='create-project-input'
              placeholder='Filming Dates'
              value={dates}
              onChange={(event) => setDates(event.target.value)}
            />
            <textarea
              className='create-project-input create-project-textarea'
              placeholder='Description (please add logline and acting roles here)'
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <section className='role-picker'>
              <div className='role-picker-header'>
                <h5>Needed Roles</h5>
                <span>{selectedRoleIds.length} selected</span>
              </div>
              <div className='role-picker-grid'>
                {roles.map((role) => {
                  const isSelected = selectedRoleIds.includes(role.ID);
                  return (
                    <label key={role.ID} className={`role-chip ${isSelected ? 'role-chip-selected' : ''}`}>
                      <input
                        className='role-input'
                        type='checkbox'
                        checked={isSelected}
                        onChange={() => toggleRole(role.ID)}
                      />
                      <span className='role-text'>{role.TITLE}</span>
                    </label>
                  );
                })}
              </div>
            </section>
            <button type='submit' className='create-project-button' disabled={isCreating}>
              {isCreating ? 'Saving...' : 'Save Project'}
            </button>
          </form>
        </div>
      )}
      {error && <p>{error}</p>}
      <div className='side-by-side'>
            <Projects
              name="Your Projects"
              icon={icons.plus}
              projects={yourProjects}
              loading={loading}
              onIconClick={() => setShowCreateForm((previous) => !previous)}
            />
            <Projects name="All Projects" icon={icons.go} projects={projects} loading={loading} onIconClick={() => navigate('/results')}/>
      </div>
    </>
  )
}

  type NavbarProps = {
  onThemeToggle: () => void;
  currentTheme: Theme;
  icons: ThemeIcons;
};

export function Navbar({ onThemeToggle, currentTheme, icons }: NavbarProps) {
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState<'project' | 'profile' | 'roles'>('project');
  const [searchTerm, setSearchTerm] = useState('');

  const goHome = () => {
    navigate("/");
  };

  const goToResults = () => {
    const query = new URLSearchParams({
      q: searchTerm.trim(),
      type: searchType,
    });
    navigate(`/results?${query.toString()}`);
  };

  return (
    <div className='navbar-wrapper'>
      <div className='navbar-item site-title'>
        <h3 onClick={goHome} className='site-title-text link'>CALLSHEET</h3>
      </div>
      <div className='navbar-item search-bar'>
        <select
          className='search-selector link'
          value={searchType}
          onChange={(event) => setSearchType(event.target.value as 'project' | 'profile' | 'roles')}
        >
          <option value='project'>Projects</option>
          <option value='profile'>Profiles</option>
          <option value='roles'>Roles</option>
        </select>
        <input
          className='search-field'
          placeholder={searchType === 'project'
            ? 'Search projects'
            : searchType === 'profile'
              ? 'Search profiles'
              : 'Search roles'}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              goToResults();
            }
          }}
        />
        <img src={icons.search} onClick={goToResults} className="search-icon icon link" alt="Search icon" />
      </div>
      <img
        src={currentTheme === 'light' ? icons.moon : icons.sun}
        className="navbar-item theme-icon icon link"
        alt="Theme icon"
        onClick={onThemeToggle}
      />
      <button type='button' className='navbar-profile-link link' onClick={() => navigate('/profile')}>
        My Profile
      </button>
      <UserButton />
    </div>
  )
}

// <img src={accountIcon} onClick={goToAccount} className="navbar-item account-icon icon link" alt="Account icon" />
// <img src={dropdownIcon} className="dropdown-icon icon" alt="Dropdown icon" />

/* export const Films = () => {
  return (
    <>
      <div className="film-container">
        {dummyData.map((data, key) => {
          return (
            <div key={key}>
              <FilmCard
                key={key}
                NAME={data.NAME}
                DATES={data.DATES}
                DESCRIPTION={data.DESCRIPTION}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}; */

export const FilmCard = ({ NAME, DATES, DESCRIPTION, FILMID, ROLES }: { NAME?: string; DATES?: string; DESCRIPTION?: string; FILMID?: string; ROLES?: string[] }) => {
  const navigate = useNavigate();
  
  if (!NAME) return <div />;

  const handleClick = () => {
    navigate(`/film/${FILMID}`);
  };

  return (
    <>
      <div className='film-card-wrapper link' onClick={handleClick}>
        <h4 className='film-title'>
          {NAME}
        </h4>
        <h5 className='film-dates'>
          {DATES}
        </h5>
        <p className='film-details'>
          {DESCRIPTION}
        </p>
        <p className='film-details'>
          {ROLES && ROLES.length > 0 ? ROLES.join(' · ') : 'No roles selected'}
        </p>
      </div>
    </>
  )
}

function Projects({
  name,
  icon,
  projects,
  loading,
  onIconClick,
}: {
  name?: string;
  icon?: string;
  projects: ProjectData[];
  loading: boolean;
  onIconClick?: () => void;
}) {
  return (
    <>
      <div className='projects-wrapper'>
        <div className='projects-header'>
          <h2 className='projects-header-title'>
            {name}
          </h2>
          <img
            src={icon}
            className="projects-header-icon icon link"
            alt="Action icon"
            onClick={onIconClick}
          />
        </div>
        <div className='projects'>
          {loading && <p>Loading projects...</p>}
          {!loading && projects.length === 0 && <p>No projects found.</p>}
          {!loading && projects.map((data, key) => (
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
  )
}

export default App
