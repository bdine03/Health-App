import React, { useState } from 'react';
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
};

type Props = NativeStackScreenProps<RootStackParamList, 'FitnessPlanForm'>;

interface FitnessFormData {
  weightKg: string;
  weightLbs: string;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  age: string;
  gender: string;
  fitnessGoal: string;
  fitnessLevel: string;
  activityLevel: string;
  weightLossGoal: string;
  workoutDays: string;
  availableEquipment: string[];
}

const fitnessGoals = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'general_fitness', label: 'General Fitness' },
  { value: 'flexibility', label: 'Flexibility' },
];

const fitnessLevels = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const activityLevels = [
  { value: 'sedentary', label: 'Sedentary (little or no exercise)' },
  { value: 'lightly_active', label: 'Lightly Active (light exercise 1-3 days/week)' },
  { value: 'moderately_active', label: 'Moderately Active (moderate exercise 3-5 days/week)' },
  { value: 'very_active', label: 'Very Active (hard exercise 6-7 days/week)' },
  { value: 'extremely_active', label: 'Extremely Active (very hard exercise, physical job)' },
];

const equipmentOptions = [
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'pull_up_bar', label: 'Pull-up Bar' },
  { value: 'bike', label: 'Bicycle' },
  { value: 'rower', label: 'Rowing Machine' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'jump_rope', label: 'Jump Rope' },
  { value: 'mat', label: 'Yoga Mat' },
  { value: 'pool', label: 'Access to Pool' },
  { value: 'stairs', label: 'Stairs' },
];

const FitnessPlanForm = ({ navigation }: Props) => {
  const [formData, setFormData] = useState<FitnessFormData>({
    weightKg: '',
    weightLbs: '',
    heightCm: '',
    heightFt: '',
    heightIn: '',
    age: '',
    gender: 'male',
    fitnessGoal: 'general_fitness',
    fitnessLevel: 'beginner',
    activityLevel: 'moderately_active',
    weightLossGoal: '',
    workoutDays: '3',
    availableEquipment: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FitnessFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<FitnessFormData> = {};
    
    if (!formData.weightKg || parseFloat(formData.weightKg) <= 0) {
      newErrors.weightKg = 'Please enter a valid weight';
    }
    
    if (!formData.heightCm || parseFloat(formData.heightCm) <= 0) {
      newErrors.heightCm = 'Please enter a valid height';
    }
    
    if (!formData.age || parseInt(formData.age) <= 0) {
      newErrors.age = 'Please enter a valid age';
    }
    
    if (!formData.gender) {
      newErrors.gender = 'Please select your gender';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleWeightChange = (value: string, unit: 'kg' | 'lbs') => {
    // Allow free typing; convert/validate on submit
    setFormData(prev => ({
      ...prev,
      [unit === 'kg' ? 'weightKg' : 'weightLbs']: value,
    }));
  };

  const handleHeightChange = (value: string, unit: 'cm' | 'ft' | 'in') => {
    // Allow free typing; convert/validate on submit
    setFormData(prev => ({
      ...prev,
      [unit === 'cm' ? 'heightCm' : unit === 'ft' ? 'heightFt' : 'heightIn']: value,
    }));
  };

  const toggleEquipment = (equipment: string) => {
    setFormData(prev => ({
      ...prev,
      availableEquipment: prev.availableEquipment.includes(equipment)
        ? prev.availableEquipment.filter(e => e !== equipment)
        : [...prev.availableEquipment, equipment],
    }));
  };

  const handleSubmit = async () => {
    if (validateForm()) {
      setIsLoading(true);
      try {
        // Normalize numeric fields
        const weightKgNormalized =
          formData.weightKg?.trim().length > 0
            ? parseFloat(formData.weightKg)
            : formData.weightLbs?.trim().length > 0
            ? parseFloat(formData.weightLbs) * 0.453592
            : 0;
        const heightCmNormalized =
          formData.heightCm?.trim().length > 0
            ? parseFloat(formData.heightCm)
            : (() => {
                const ft = parseFloat(formData.heightFt || '0') || 0;
                const inches = parseFloat(formData.heightIn || '0') || 0;
                return ft * 30.48 + inches * 2.54;
              })();

        const requestData = {
          weight_kg: weightKgNormalized,
          height_cm: heightCmNormalized,
          age: parseInt(formData.age),
          gender: formData.gender,
          fitness_goal: formData.fitnessGoal,
          fitness_level: formData.fitnessLevel,
          activity_level: formData.activityLevel,
          weight_loss_goal: parseFloat(formData.weightLossGoal) || 0,
          workout_days: parseInt(formData.workoutDays),
          available_equipment: formData.availableEquipment,
        };

        const response = await fetch('http://localhost:5002/generate-fitness-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate fitness plan');
        }

        const data = await response.json();
        navigation.navigate('FitnessPlan', {
          fitnessPlan: data.fitness_plan,
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
      <Text style={styles.title}>Fitness Plan Generator</Text>

      {/* Basic Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            value={formData.weightKg}
            onChangeText={(value) => handleWeightChange(value, 'kg')}
            placeholder="Enter weight in kg"
          />
          {errors.weightKg && (
            <Text style={styles.errorText}>{errors.weightKg}</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weight (lbs)</Text>
          <TextInput
            style={styles.input}
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            value={formData.weightLbs}
            onChangeText={(value) => handleWeightChange(value, 'lbs')}
            placeholder="Enter weight in lbs"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Height (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            value={formData.heightCm}
            onChangeText={(value) => handleHeightChange(value, 'cm')}
            placeholder="Enter height in cm"
          />
          {errors.heightCm && (
            <Text style={styles.errorText}>{errors.heightCm}</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Height (ft/in)</Text>
          <View style={styles.heightRow}>
            <TextInput
              style={[styles.input, styles.heightInput]}
              keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              value={formData.heightFt}
              onChangeText={(value) => handleHeightChange(value, 'ft')}
              placeholder="ft"
            />
            <Text style={styles.heightLabel}>ft</Text>
            <TextInput
              style={[styles.input, styles.heightInput]}
              keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              value={formData.heightIn}
              onChangeText={(value) => handleHeightChange(value, 'in')}
              placeholder="in"
            />
            <Text style={styles.heightLabel}>in</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={formData.age}
            onChangeText={(value) => setFormData(prev => ({ ...prev, age: value }))}
            placeholder="Enter your age"
          />
          {errors.age && (
            <Text style={styles.errorText}>{errors.age}</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[styles.radioButton, formData.gender === 'male' && styles.radioButtonSelected]}
              onPress={() => setFormData(prev => ({ ...prev, gender: 'male' }))}
            >
              <Text style={[styles.radioButtonText, formData.gender === 'male' && styles.radioButtonTextSelected]}>
                Male
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioButton, formData.gender === 'female' && styles.radioButtonSelected]}
              onPress={() => setFormData(prev => ({ ...prev, gender: 'female' }))}
            >
              <Text style={[styles.radioButtonText, formData.gender === 'female' && styles.radioButtonTextSelected]}>
                Female
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Fitness Goals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fitness Goals</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Primary Goal</Text>
          {fitnessGoals.map((goal) => (
            <TouchableOpacity
              key={goal.value}
              style={[styles.radioButton, formData.fitnessGoal === goal.value && styles.radioButtonSelected]}
              onPress={() => setFormData(prev => ({ ...prev, fitnessGoal: goal.value }))}
            >
              <Text style={[styles.radioButtonText, formData.fitnessGoal === goal.value && styles.radioButtonTextSelected]}>
                {goal.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fitness Level</Text>
          {fitnessLevels.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[styles.radioButton, formData.fitnessLevel === level.value && styles.radioButtonSelected]}
              onPress={() => setFormData(prev => ({ ...prev, fitnessLevel: level.value }))}
            >
              <Text style={[styles.radioButtonText, formData.fitnessLevel === level.value && styles.radioButtonTextSelected]}>
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Activity Level</Text>
          {activityLevels.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[styles.radioButton, formData.activityLevel === level.value && styles.radioButtonSelected]}
              onPress={() => setFormData(prev => ({ ...prev, activityLevel: level.value }))}
            >
              <Text style={[styles.radioButtonText, formData.activityLevel === level.value && styles.radioButtonTextSelected]}>
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {formData.fitnessGoal === 'weight_loss' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Weight Loss Goal (kg)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={formData.weightLossGoal}
              onChangeText={(value) => setFormData(prev => ({ ...prev, weightLossGoal: value }))}
              placeholder="Enter weight loss goal"
            />
          </View>
        )}
      </View>

      {/* Workout Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Preferences</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Workout Days per Week</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={formData.workoutDays}
            onChangeText={(value) => setFormData(prev => ({ ...prev, workoutDays: value }))}
            placeholder="3-7 days"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Available Equipment</Text>
          <View style={styles.checkboxContainer}>
            {equipmentOptions.map((equipment) => (
              <View key={equipment.value} style={styles.checkboxRow}>
                <CheckBox
                  value={formData.availableEquipment.includes(equipment.value)}
                  onValueChange={() => toggleEquipment(equipment.value)}
                />
                <Text style={styles.checkboxLabel}>{equipment.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} 
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Generate Fitness Plan</Text>
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
  section: {
    marginBottom: 30,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 15,
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
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heightInput: {
    flex: 1,
    marginRight: 10,
  },
  heightLabel: {
    fontSize: 16,
    marginRight: 15,
    fontWeight: '500',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  radioButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
    marginBottom: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  radioButtonText: {
    fontSize: 14,
    color: '#333',
  },
  radioButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
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

export default FitnessPlanForm; 