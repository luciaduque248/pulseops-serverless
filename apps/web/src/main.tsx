import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { appConfig } from './config';
import { AuthProvider } from './auth';
import App from './App';
import './styles.css';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: appConfig.cognito.userPoolId,
      userPoolClientId: appConfig.cognito.userPoolClientId,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
