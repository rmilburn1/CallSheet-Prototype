export type ProjectData = {
  ID: string;
  NAME: string;
  DATES: string;
  DESCRIPTION: string;
  USER_ID: string;
  CREATOR_USERNAME: string;
  CREATOR_FULL_NAME: string;
  CREATOR_EMAIL: string;
  ROLES: string[];
};

export type RoleData = {
  ID: string;
  TITLE: string;
};

export type ProfileData = {
  USERNAME: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  FULL_NAME: string;
  EMAIL: string;
  PROJECTS: ProjectData[];
};

type ProjectListResponse = {
  projects: ProjectData[];
};

type RoleListResponse = {
  roles: RoleData[];
};

type ProfileResponse = {
  profile: {
    USERNAME: string;
    FIRST_NAME: string;
    LAST_NAME: string;
    FULL_NAME: string;
    EMAIL: string;
  };
  projects: ProjectData[];
};

type CreateProjectInput = {
  NAME: string;
  DATES: string;
  DESCRIPTION: string;
  USER_ID?: string;
  OWNER_USERNAME?: string;
  OWNER_EMAIL?: string;
  OWNER_FIRST_NAME?: string;
  OWNER_LAST_NAME?: string;
  ROLE_IDS?: string[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const PROJECTS_ENDPOINT = `${API_BASE_URL}/api/projects`;
const ROLES_ENDPOINT = `${API_BASE_URL}/api/roles`;
const PROFILE_ENDPOINT = `${API_BASE_URL}/api/profile`;

async function ensureJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'API request failed');
  }

  return response.json() as Promise<T>;
}

export async function fetchData(search = '', searchType: 'project' | 'profile' = 'project'): Promise<ProjectData[]> {
  const query = search.trim();
  const endpoint = query
    ? `${PROJECTS_ENDPOINT}?search=${encodeURIComponent(query)}&search_type=${encodeURIComponent(searchType)}`
    : PROJECTS_ENDPOINT;

  const response = await fetch(endpoint, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await ensureJson<ProjectListResponse>(response);
  return payload.projects;
}

export async function fetchRoles(): Promise<RoleData[]> {
  const response = await fetch(ROLES_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await ensureJson<RoleListResponse>(response);
  return payload.roles;
}

export async function fetchProfile(username: string): Promise<ProfileData> {
  const response = await fetch(`${PROFILE_ENDPOINT}/${encodeURIComponent(username)}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await ensureJson<ProfileResponse>(response);
  return {
    ...payload.profile,
    PROJECTS: payload.projects,
  };
}

export async function createProject(input: CreateProjectInput): Promise<ProjectData> {
  const response = await fetch(PROJECTS_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      NAME: input.NAME,
      DATES: input.DATES,
      DESCRIPTION: input.DESCRIPTION,
      USER_ID: input.USER_ID ?? '1',
      OWNER_USERNAME: input.OWNER_USERNAME ?? input.USER_ID ?? '',
      OWNER_EMAIL: input.OWNER_EMAIL ?? '',
      OWNER_FIRST_NAME: input.OWNER_FIRST_NAME ?? '',
      OWNER_LAST_NAME: input.OWNER_LAST_NAME ?? '',
      ROLE_IDS: (input.ROLE_IDS ?? []).map((roleId) => Number(roleId)),
    }),
  });

  return ensureJson<ProjectData>(response);
}
