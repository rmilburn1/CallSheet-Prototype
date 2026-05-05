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
  BIO?: string;
  SOCIAL_LINKS?: Record<string, string>;
  INTERESTED_ROLES?: { ID: string; TITLE: string }[];
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

type SyncClerkUserInput = {
  USERNAME?: string;
  EMAIL?: string;
  FIRST_NAME?: string;
  LAST_NAME?: string;
  FULL_NAME?: string;
};

type DeleteProjectInput = {
  OWNER_USERNAME?: string;
  OWNER_EMAIL?: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const PROJECTS_ENDPOINT = `${API_BASE_URL}/api/projects`;
const ROLES_ENDPOINT = `${API_BASE_URL}/api/roles`;
const PROFILE_ENDPOINT = `${API_BASE_URL}/api/profile`;
const CLERK_SYNC_ENDPOINT = `${API_BASE_URL}/api/clerk/sync-user`;

async function ensureJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'API request failed');
  }

  return response.json() as Promise<T>;
}

export async function fetchData(search = '', searchType: 'project' | 'profile' | 'roles' = 'project'): Promise<ProjectData[]> {
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

  if (response.status === 404) {
    throw new Error('User not found');
  }

  const payload = await ensureJson<ProfileResponse>(response);
  return {
    ...payload.profile,
    PROJECTS: payload.projects,
  };
}

type UpdateProfileInput = {
  BIO?: string | null;
  SOCIAL_LINKS?: Record<string, string> | null;
  INTERESTED_ROLE_IDS?: number[];
};

export async function updateProfile(username: string, input: UpdateProfileInput, ownerUsername?: string, ownerEmail?: string): Promise<ProfileData> {
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (ownerUsername) headers['X-Owner-Username'] = ownerUsername;
  if (ownerEmail) headers['X-Owner-Email'] = ownerEmail;

  const response = await fetch(`${PROFILE_ENDPOINT}/${encodeURIComponent(username)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      ...headers,
    },
    body: JSON.stringify({
      BIO: input.BIO ?? null,
      SOCIAL_LINKS: input.SOCIAL_LINKS ?? null,
      INTERESTED_ROLE_IDS: input.INTERESTED_ROLE_IDS ?? [],
    }),
  });

  const payload = await ensureJson<{ profile: Partial<ProfileData> }>(response);
  return {
    USERNAME: payload.profile.USERNAME ?? username,
    FIRST_NAME: payload.profile.FIRST_NAME ?? '',
    LAST_NAME: payload.profile.LAST_NAME ?? '',
    FULL_NAME: payload.profile.FULL_NAME ?? '',
    EMAIL: payload.profile.EMAIL ?? '',
    BIO: payload.profile.BIO ?? '',
    SOCIAL_LINKS: (payload.profile.SOCIAL_LINKS as Record<string, string>) ?? {},
    INTERESTED_ROLES: (payload.profile.INTERESTED_ROLES as { ID: string; TITLE: string }[]) ?? [],
    PROJECTS: [],
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

export async function deleteProject(projectId: string, input?: DeleteProjectInput): Promise<void> {
  const params = new URLSearchParams();
  if (input?.OWNER_USERNAME) {
    params.set('owner_username', input.OWNER_USERNAME);
  }
  if (input?.OWNER_EMAIL) {
    params.set('owner_email', input.OWNER_EMAIL);
  }

  const endpoint = params.toString()
    ? `${PROJECTS_ENDPOINT}/${encodeURIComponent(projectId)}?${params.toString()}`
    : `${PROJECTS_ENDPOINT}/${encodeURIComponent(projectId)}`;

  const response = await fetch(endpoint, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(input?.OWNER_USERNAME ? { 'X-Owner-Username': input.OWNER_USERNAME } : {}),
      ...(input?.OWNER_EMAIL ? { 'X-Owner-Email': input.OWNER_EMAIL } : {}),
    },
  });

  await ensureJson<{ message: string }>(response);
}

export async function syncClerkUser(input: SyncClerkUserInput): Promise<void> {
  const response = await fetch(CLERK_SYNC_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      USERNAME: input.USERNAME ?? '',
      EMAIL: input.EMAIL ?? '',
      FIRST_NAME: input.FIRST_NAME ?? '',
      LAST_NAME: input.LAST_NAME ?? '',
      FULL_NAME: input.FULL_NAME ?? '',
    }),
  });

  await ensureJson<{ user: ProfileData }>(response);
}
