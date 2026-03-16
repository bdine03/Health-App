import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import CheckBox from '@react-native-community/checkbox';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

type RootStackParamList = {
  Home: undefined;
  GroceryPlan: {
    mealPlan: any;
    groceryList: any[];
    totalItems: number;
    totalBudget: string;
    remainingBudget: string;
    dailyNutritionTargets: any;
    totalNutrition: any;
    nearbyStores: any[];
  };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface FormData {
  weightLossPounds: string;
  weightLossKg: string;
  healthGoals: string;
  allergies: string[];
  groceryBudget: string;
}

const commonAllergies = [
  'Peanuts',
  'Tree Nuts',
  'Milk',
  'Eggs',
  'Soy',
  'Wheat',
  'Fish',
  'Shellfish',
];

const UserInputForm = ({ navigation }: Props) => {
  const [formData, setFormData] = useState<FormData>({
    weightLossPounds: '',
    weightLossKg: '',
    healthGoals: '',
    allergies: [],
    groceryBudget: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Permission to access location was denied');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        setLocationError('Error getting location');
        console.error('Error getting location:', error);
      }
    })();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};
    
    if (!formData.weightLossPounds || parseFloat(formData.weightLossPounds) <= 0) {
      newErrors.weightLossPounds = 'Please enter a valid weight loss goal';
    }
    
    if (!formData.healthGoals.trim()) {
      newErrors.healthGoals = 'Please enter your health goals';
    }
    
    if (!formData.groceryBudget || parseFloat(formData.groceryBudget) <= 0) {
      newErrors.groceryBudget = 'Please enter a valid budget';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleWeightLossChange = (value: string, unit: 'pounds' | 'kg') => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const pounds = unit === 'pounds' ? numValue : numValue * 2.20462;
      const kg = unit === 'kg' ? numValue : numValue / 2.20462;
      
      setFormData(prev => ({
        ...prev,
        weightLossPounds: pounds.toFixed(2),
        weightLossKg: kg.toFixed(2),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [unit === 'pounds' ? 'weightLossPounds' : 'weightLossKg']: value,
      }));
    }
  };

  const toggleAllergy = (allergy: string) => {
    setFormData(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter(a => a !== allergy)
        : [...prev.allergies, allergy],
    }));
  };

  const handleSubmit = async () => {
    if (validateForm()) {
      setIsLoading(true);
      try {
        const requestData = {
          weight_loss_goal: parseFloat(formData.weightLossPounds),
          health_goals: formData.healthGoals,
          allergies: formData.allergies,
          budget: parseFloat(formData.groceryBudget),
        };

        // Add location if available
        if (location) {
          Object.assign(requestData, {
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }

        const response = await fetch('http://localhost:5002/optimize-grocery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to optimize grocery list');
        }

        const data = await response.json();
        navigation.navigate('GroceryPlan', {
          mealPlan: data.meal_plan,
          groceryList: data.grocery_list,
          totalItems: data.total_items,
          totalBudget: data.total_budget,
          remainingBudget: data.remaining_budget,
          dailyNutritionTargets: data.daily_nutrition_targets,
          totalNutrition: data.total_nutrition,
          nearbyStores: data.nearby_stores,
        });
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    } else {
      Alert.alert('Validation Error', 'Please check all required fields');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>User Information Form</Text>

      {locationError && (
        <Text style={styles.errorText}>
          {locationError} - Nearby stores will not be available
        </Text>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Weight Loss Goal (Pounds)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={formData.weightLossPounds}
          onChangeText={(value) => handleWeightLossChange(value, 'pounds')}
          placeholder="Enter weight loss goal in pounds"
        />
        {errors.weightLossPounds && (
          <Text style={styles.errorText}>{errors.weightLossPounds}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Weight Loss Goal (Kilograms)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={formData.weightLossKg}
          onChangeText={(value) => handleWeightLossChange(value, 'kg')}
          placeholder="Enter weight loss goal in kilograms"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Health Goals</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          multiline
          numberOfLines={4}
          value={formData.healthGoals}
          onChangeText={(value) => setFormData(prev => ({ ...prev, healthGoals: value }))}
          placeholder="Enter your health goals"
        />
        {errors.healthGoals && (
          <Text style={styles.errorText}>{errors.healthGoals}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Allergies</Text>
        <View style={styles.checkboxContainer}>
          {commonAllergies.map((allergy) => (
            <View key={allergy} style={styles.checkboxRow}>
              <CheckBox
                value={formData.allergies.includes(allergy)}
                onValueChange={() => toggleAllergy(allergy)}
              />
              <Text style={styles.checkboxLabel}>{allergy}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Grocery Budget ($)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={formData.groceryBudget}
          onChangeText={(value) => setFormData(prev => ({ ...prev, groceryBudget: value }))}
          placeholder="Enter your weekly grocery budget"
        />
        {errors.groceryBudget && (
          <Text style={styles.errorText}>{errors.groceryBudget}</Text>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} 
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
});

export default UserInputForm; 