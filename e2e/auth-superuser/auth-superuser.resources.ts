import { Environments, Superuser } from './auth-superuser.type';

export const SUPERUSERS: Record<Environments, Superuser> = {
  dev: {
    username: 'diego.goldener@gmail.com',
    password: 'Test123!',
  },
  ci: {
    username: 'diego.goldener@gmail.com',
    password: 'Test123!',
  },
  pre: {
    username: 'diego.goldener@subsidia.ch',
    password: '~kD3q2rM#FP7',
  },
};
