const readEnv = (name: 'VITE_API_URL' | 'VITE_COGNITO_USER_POOL_ID' | 'VITE_COGNITO_CLIENT_ID') => {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value as string;
};

export const appConfig = {
  apiUrl: readEnv('VITE_API_URL').replace(/\/$/, ''),
  cognito: {
    userPoolId: readEnv('VITE_COGNITO_USER_POOL_ID'),
    userPoolClientId: readEnv('VITE_COGNITO_CLIENT_ID'),
  },
};
