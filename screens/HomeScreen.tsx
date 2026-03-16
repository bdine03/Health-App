import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  GroceryPlan: {
    mealPlan?: any;
    groceryList?: any[];
    totalItems?: number;
    totalBudget?: string;
    remainingBudget?: string;
    dailyNutritionTargets?: any;
    totalNutrition?: any;
    nearbyStores?: any[];
  } | undefined;
  OrderTracking: undefined;
  FitnessPlanForm: undefined;
  FitnessPlan: {
    fitnessPlan: any;
  };
  AIRecipeGenerator: undefined;
  SocialChallenges: undefined;
  SmartShopping: undefined;
  HealthInsights: undefined;
  VoiceAssistant: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen = ({ navigation }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Healthify Home</Text>
      <Text style={styles.subtitle}>Your complete health and fitness companion</Text>
      
      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('GroceryPlan')}>
            <Text style={styles.ctaButtonText}>🍽️ Create Meal Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('AIRecipeGenerator')}>
            <Text style={styles.ctaButtonText}>🤖 AI Recipe Generator</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.buttonSpacer} />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('FitnessPlanForm')}>
            <Text style={styles.ctaButtonText}>💪 Create Fitness Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('SocialChallenges')}>
            <Text style={styles.ctaButtonText}>🏆 Social Challenges</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.buttonSpacer} />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('SmartShopping')}>
            <Text style={styles.ctaButtonText}>🛒 Smart Shopping</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('HealthInsights')}>
            <Text style={styles.ctaButtonText}>📊 Health Insights</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.buttonSpacer} />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('VoiceAssistant')}>
            <Text style={styles.ctaButtonText}>🎤 Voice Assistant</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('OrderTracking')}>
            <Text style={styles.ctaButtonText}>📦 Track Orders</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>✨ New Features</Text>
        <Text style={styles.featureText}>• AI-powered recipe generation</Text>
        <Text style={styles.featureText}>• Social fitness challenges & leaderboards</Text>
        <Text style={styles.featureText}>• Smart grocery price comparison</Text>
        <Text style={styles.featureText}>• Personalized health insights</Text>
        <Text style={styles.featureText}>• Voice-activated commands</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 28,
    marginBottom: 8,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 30,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  ctaButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonSpacer: {
    height: 15,
  },
  featuresContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
});

export default HomeScreen;
