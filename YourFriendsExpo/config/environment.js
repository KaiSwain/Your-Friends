import Constants from 'expo-constants';

// Configuration based on environment
const ENV = {
  development: {
    API_BASE_URL: 'http://localhost:8000/api',
    DEBUG: true,
  },
  staging: {
    API_BASE_URL: 'https://your-api-staging.herokuapp.com/api',
    DEBUG: false,
  },
  production: {
    API_BASE_URL: 'https://your-api.herokuapp.com/api',
    DEBUG: false,
  }
};

// Get current environment
const getEnvVars = (env = Constants.expoConfig?.releaseChannel) => {
  // Default to development if no release channel is set
  if (__DEV__) {
    return ENV.development;
  } else if (env === 'staging') {
    return ENV.staging;
  } else {
    return ENV.production;
  }
};

export default getEnvVars();