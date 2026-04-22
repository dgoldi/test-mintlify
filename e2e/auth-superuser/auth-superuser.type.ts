export type Environments = 'dev' | 'ci' | 'pre';

export type Superuser = {
  username: string;
  password: string;
};

const ENVS: Record<Environments, Environments> = {
  dev: 'dev',
  ci: 'ci',
  pre: 'pre',
};

export function getEnvironment(env?: string): Environments {
  return ENVS[env as Environments] ? ENVS[env as Environments] : 'dev';
}
