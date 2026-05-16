import { ExpoConfig, ConfigContext } from 'expo/config';

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'OmniKinetix',
  slug: 'omnikininetix',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'omnikininetix',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  android: {
    adaptiveIcon: {
      backgroundColor: '#0d9488',
    },
    package: 'com.omnikininetix.mobile',
  },
  plugins: ['expo-secure-store', 'expo-asset'],
  extra: {
    apiUrl: API_URL,
  },
});
