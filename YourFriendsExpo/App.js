import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Platform,
} from 'react-native';
import { utilityAPI } from './services/api';
import ENV from './config/environment';

export default function App() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [apiStatus, setApiStatus] = useState('Checking...');
  const [apiResponse, setApiResponse] = useState(null);

  const testApiConnection = async () => {
    try {
      setApiStatus('Testing connection...');
      const response = await utilityAPI.healthCheck();
      setApiStatus('Connected ✅');
      setApiResponse(response.data);
    } catch (error) {
      setApiStatus('Connection failed ❌');
      setApiResponse(null);
      console.error('API connection error:', error);
    }
  };

  const showApiInfo = async () => {
    try {
      const response = await utilityAPI.getApiRoot();
      Alert.alert(
        'API Info',
        JSON.stringify(response.data, null, 2),
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to fetch API info\n\nMake sure your Django backend is running at ${ENV.API_BASE_URL}`);
    }
  };

  useEffect(() => {
    testApiConnection();
  }, []);

  const styles = getStyles(isDarkMode);

  return (
    <ScrollView style={styles.container}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={styles.content}>
        <Text style={styles.title}>Your Friends App</Text>
        <Text style={styles.subtitle}>React Native + Django (Expo Version)</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backend Connection</Text>
          <Text style={styles.status}>Status: {apiStatus}</Text>
          
          {apiResponse && (
            <View style={styles.responseContainer}>
              <Text style={styles.responseText}>
                {apiResponse.message}
              </Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.button} onPress={testApiConnection}>
            <Text style={styles.buttonText}>Test Connection</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={showApiInfo}>
            <Text style={styles.buttonText}>API Info</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Connect</Text>
          <Text style={styles.text}>
            1. Start Django backend:{'\n'}
            cd back && python3 manage.py runserver{'\n\n'}
            2. Current API URL: {ENV.API_BASE_URL}{'\n\n'}
            3. For physical device testing:{'\n'}
            Update API_BASE_URL in config/environment.js{'\n\n'}
            4. Your Django API endpoints:{'\n'}
            • {ENV.API_BASE_URL}/{'\n'}
            • {ENV.API_BASE_URL}/health/
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Development Notes</Text>
          <Text style={styles.text}>
            • This is an Expo version for easy mobile testing{'\n'}
            • Original React Native CLI version is in the 'front' folder{'\n'}
            • Both versions connect to the same Django backend{'\n'}
            • Use Expo Go app to scan QR code for instant preview!
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const getStyles = (isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#000000' : '#F3F3F3',
  },
  content: {
    padding: 24,
    paddingTop: 60, // Account for status bar
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: isDarkMode ? '#FFFFFF' : '#000000',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: isDarkMode ? '#DAE1E7' : '#444444',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: isDarkMode ? '#FFFFFF' : '#000000',
  },
  status: {
    fontSize: 16,
    marginBottom: 16,
    color: isDarkMode ? '#DAE1E7' : '#444444',
  },
  responseContainer: {
    backgroundColor: isDarkMode ? '#333333' : '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  responseText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: isDarkMode ? '#DAE1E7' : '#444444',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: isDarkMode ? '#DAE1E7' : '#444444',
  },
});
