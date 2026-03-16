import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'FitnessPlan'>;

const FitnessPlanScreen = ({ route, navigation }: Props) => {
  const { fitnessPlan } = route.params;
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(1);
  
  // Group workouts by week
  const workoutsByWeek: { [key: number]: any[] } = {};
  fitnessPlan.workout_plan.forEach((workout: any) => {
    const week = workout.week || 1;
    if (!workoutsByWeek[week]) {
      workoutsByWeek[week] = [];
    }
    workoutsByWeek[week].push(workout);
  });
  
  const currentWeekWorkouts = workoutsByWeek[selectedWeek] || [];
  const selectedWorkout = currentWeekWorkouts[selectedWorkoutDay] || currentWeekWorkouts[0];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '#28a745';
      case 'intermediate': return '#ffc107';
      case 'advanced': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getFocusColor = (focus: string) => {
    switch (focus) {
      case 'cardio_and_strength': return '#007bff';
      case 'strength_training': return '#dc3545';
      case 'cardio': return '#28a745';
      case 'flexibility_and_yoga': return '#6f42c1';
      case 'balanced': return '#fd7e14';
      default: return '#6c757d';
    }
  };

  const getFocusDisplayName = (focus: string) => {
    switch (focus) {
      case 'cardio_and_strength': return 'Cardio & Strength';
      case 'strength_training': return 'Strength Training';
      case 'cardio': return 'Cardio';
      case 'flexibility_and_yoga': return 'Flexibility & Yoga';
      case 'balanced': return 'Balanced';
      default: return focus;
    }
  };

  const renderMetrics = () => {
    return (
      <View style={styles.metricsContainer}>
        <Text style={styles.sectionTitle}>Your Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Weight</Text>
            <Text style={styles.metricValue}>{fitnessPlan.weight_kg} kg</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Height</Text>
            <Text style={styles.metricValue}>{fitnessPlan.height_cm} cm</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>BMI</Text>
            <Text style={styles.metricValue}>{fitnessPlan.bmi}</Text>
            <Text style={styles.metricSubtext}>{fitnessPlan.bmi_category}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Age</Text>
            <Text style={styles.metricValue}>{fitnessPlan.age || 'N/A'}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMetabolicInfo = () => {
    return (
      <View style={styles.metabolicContainer}>
        <Text style={styles.sectionTitle}>Metabolic Information</Text>
        <View style={styles.metabolicGrid}>
          <View style={styles.metabolicItem}>
            <Text style={styles.metabolicLabel}>BMR (Basal Metabolic Rate)</Text>
            <Text style={styles.metabolicValue}>{fitnessPlan.bmr} calories/day</Text>
            <Text style={styles.metabolicSubtext}>Calories burned at rest</Text>
          </View>
          <View style={styles.metabolicItem}>
            <Text style={styles.metabolicLabel}>TDEE (Total Daily Energy Expenditure)</Text>
            <Text style={styles.metabolicValue}>{fitnessPlan.tdee} calories/day</Text>
            <Text style={styles.metabolicSubtext}>Total calories needed</Text>
          </View>
          <View style={styles.metabolicItem}>
            <Text style={styles.metabolicLabel}>Target Calories</Text>
            <Text style={styles.metabolicValue}>{fitnessPlan.target_calories} calories/day</Text>
            <Text style={styles.metabolicSubtext}>Based on your goal</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderNutritionRecommendations = () => {
    const nutrition = fitnessPlan.nutrition_recommendations;
    return (
      <View style={styles.nutritionContainer}>
        <Text style={styles.sectionTitle}>Nutrition Recommendations</Text>
        <View style={styles.nutritionGrid}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Protein</Text>
            <Text style={styles.nutritionValue}>{nutrition.protein_g}g</Text>
            <Text style={styles.nutritionSubtext}>Build and repair muscle</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Carbohydrates</Text>
            <Text style={styles.nutritionValue}>{nutrition.carbs_g}g</Text>
            <Text style={styles.nutritionSubtext}>Energy for workouts</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Fat</Text>
            <Text style={styles.nutritionValue}>{nutrition.fat_g}g</Text>
            <Text style={styles.nutritionSubtext}>Essential nutrients</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Fiber</Text>
            <Text style={styles.nutritionValue}>{nutrition.fiber_g}g</Text>
            <Text style={styles.nutritionSubtext}>Digestive health</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Water</Text>
            <Text style={styles.nutritionValue}>{nutrition.water_liters}L</Text>
            <Text style={styles.nutritionSubtext}>Daily hydration</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderWorkoutPlan = () => {
    const weeks = Object.keys(workoutsByWeek).map(Number).sort();
    
    return (
      <View style={styles.workoutContainer}>
        <Text style={styles.sectionTitle}>Your Personalized Workout Plan</Text>
        <Text style={styles.workoutSubtitle}>
          {fitnessPlan.workout_days_per_week} days per week • 4-week progressive program
        </Text>
        
        {/* Week Selector */}
        <View style={styles.weekSelector}>
          <Text style={styles.weekSelectorLabel}>Select Week:</Text>
          <View style={styles.weekButtons}>
            {weeks.map((week) => (
              <TouchableOpacity
                key={week}
                style={[
                  styles.weekButton,
                  selectedWeek === week && styles.weekButtonSelected
                ]}
                onPress={() => {
                  setSelectedWeek(week);
                  setSelectedWorkoutDay(0);
                }}
              >
                <Text style={[
                  styles.weekButtonText,
                  selectedWeek === week && styles.weekButtonTextSelected
                ]}>
                  Week {week}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Day Selector */}
        <View style={styles.workoutDaysContainer}>
          {currentWeekWorkouts.map((workout: any, index: number) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.workoutDayButton,
                selectedWorkoutDay === index && styles.workoutDayButtonSelected
              ]}
              onPress={() => setSelectedWorkoutDay(index)}
            >
              <Text style={[
                styles.workoutDayText,
                selectedWorkoutDay === index && styles.workoutDayTextSelected
              ]}>
                Day {workout.day}
              </Text>
              <View style={[
                styles.focusBadge,
                { backgroundColor: getFocusColor(workout.focus) }
              ]}>
                <Text style={styles.focusBadgeText}>
                  {getFocusDisplayName(workout.focus)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {selectedWorkout && (
          <View style={styles.workoutDetails}>
            <Text style={styles.workoutDetailsTitle}>
              Week {selectedWorkout.week} • Day {selectedWorkout.day} - {getFocusDisplayName(selectedWorkout.focus)}
            </Text>
            <Text style={styles.workoutDuration}>
              Duration: {selectedWorkout.duration} minutes
            </Text>
            
            {selectedWorkout.circuit_style && (
              <View style={styles.circuitInfo}>
                <Text style={styles.circuitText}>
                  🔄 Circuit Training: {selectedWorkout.circuit_rounds} rounds
                </Text>
              </View>
            )}
            
            {/* Warm-up */}
            {selectedWorkout.warmup && selectedWorkout.warmup.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>🔥 Warm-up</Text>
                {selectedWorkout.warmup.map((item: any, index: number) => (
                  <View key={index} style={styles.warmupItem}>
                    <Text style={styles.warmupName}>{item.name}</Text>
                    {item.duration_seconds && (
                      <Text style={styles.warmupDetail}>
                        {Math.round(item.duration_seconds / 60)} minutes
                      </Text>
                    )}
                    {item.instructions && item.instructions.map((inst: string, i: number) => (
                      <Text key={i} style={styles.instructionText}>• {inst}</Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
            
            {/* Exercises */}
            <View style={styles.exercisesContainer}>
              <Text style={styles.exercisesTitle}>💪 Main Exercises:</Text>
              {selectedWorkout.exercises.map((exercise: any, index: number) => (
                <View key={index} style={styles.exerciseItem}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <View style={[
                      styles.difficultyBadge,
                      { backgroundColor: getDifficultyColor(exercise.difficulty) }
                    ]}>
                      <Text style={styles.difficultyText}>{exercise.difficulty}</Text>
                    </View>
                  </View>
                  
                  {/* Sets, Reps, Duration */}
                  <View style={styles.prescriptionRow}>
                    {exercise.sets && (
                      <Text style={styles.prescriptionText}>
                        Sets: {exercise.sets}
                      </Text>
                    )}
                    {exercise.reps && (
                      <Text style={styles.prescriptionText}>
                        Reps: {exercise.reps}
                      </Text>
                    )}
                    {exercise.duration_seconds && (
                      <Text style={styles.prescriptionText}>
                        Duration: {Math.round(exercise.duration_seconds / 60)} min
                      </Text>
                    )}
                    {exercise.rest_seconds && (
                      <Text style={styles.prescriptionText}>
                        Rest: {exercise.rest_seconds}s
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.exerciseDetails}>
                    <Text style={styles.exerciseDetail}>
                      Equipment: {exercise.equipment === 'none' ? 'Bodyweight' : exercise.equipment}
                    </Text>
                    {exercise.calories_per_hour && (
                      <Text style={styles.exerciseDetail}>
                        Calories: ~{Math.round(exercise.calories_per_hour / 60 * selectedWorkout.duration)} per session
                      </Text>
                    )}
                  </View>
                  
                  {/* Instructions */}
                  {exercise.instructions && exercise.instructions.length > 0 && (
                    <View style={styles.instructionsContainer}>
                      <Text style={styles.instructionsTitle}>How to perform:</Text>
                      {exercise.instructions.map((inst: string, i: number) => (
                        <Text key={i} style={styles.instructionText}>{i + 1}. {inst}</Text>
                      ))}
                    </View>
                  )}
                  
                  {/* Form Tips */}
                  {exercise.form_tips && exercise.form_tips.length > 0 && (
                    <View style={styles.tipsContainer}>
                      <Text style={styles.tipsTitle}>💡 Form Tips:</Text>
                      {exercise.form_tips.map((tip: string, i: number) => (
                        <Text key={i} style={styles.tipText}>• {tip}</Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
            
            {/* Cool-down */}
            {selectedWorkout.cooldown && selectedWorkout.cooldown.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>🧘 Cool-down</Text>
                {selectedWorkout.cooldown.map((item: any, index: number) => (
                  <View key={index} style={styles.warmupItem}>
                    <Text style={styles.warmupName}>{item.name}</Text>
                    {item.duration_seconds && (
                      <Text style={styles.warmupDetail}>
                        {Math.round(item.duration_seconds / 60)} minutes
                      </Text>
                    )}
                    {item.instructions && item.instructions.map((inst: string, i: number) => (
                      <Text key={i} style={styles.instructionText}>• {inst}</Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderProgressTracking = () => {
    const tracking = fitnessPlan.weekly_progress_tracking;
    return (
      <View style={styles.trackingContainer}>
        <Text style={styles.sectionTitle}>Progress Tracking</Text>
        <View style={styles.trackingGrid}>
          <View style={styles.trackingItem}>
            <Text style={styles.trackingLabel}>Weight Tracking</Text>
            <Text style={styles.trackingValue}>
              {tracking.weight_tracking ? '✓ Enabled' : '✗ Disabled'}
            </Text>
          </View>
          <View style={styles.trackingItem}>
            <Text style={styles.trackingLabel}>Body Measurements</Text>
            <Text style={styles.trackingValue}>
              {tracking.measurements.join(', ')}
            </Text>
          </View>
          <View style={styles.trackingItem}>
            <Text style={styles.trackingLabel}>Progress Photos</Text>
            <Text style={styles.trackingValue}>
              {tracking.progress_photos ? '✓ Enabled' : '✗ Disabled'}
            </Text>
          </View>
          <View style={styles.trackingItem}>
            <Text style={styles.trackingLabel}>Workout Logging</Text>
            <Text style={styles.trackingValue}>
              {tracking.workout_logging ? '✓ Enabled' : '✗ Disabled'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const handleStartWorkout = () => {
    if (!selectedWorkout) return;
    Alert.alert(
      'Start Workout',
      `Ready to begin Week ${selectedWorkout.week}, Day ${selectedWorkout.day}?\n\n${getFocusDisplayName(selectedWorkout.focus)} • ${selectedWorkout.duration} minutes`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => Alert.alert('Workout Started', 'Timer and exercise tracking will begin. Follow the exercise instructions and form tips for best results!') }
      ]
    );
  };

  const handleCreateMealPlan = () => {
    // Navigate to meal plan creation with fitness data
    navigation.navigate('GroceryPlan', {
      mealPlan: {},
      groceryList: [],
      totalItems: 0,
      totalBudget: '$0',
      remainingBudget: '$0',
      dailyNutritionTargets: fitnessPlan.nutrition_recommendations,
      totalNutrition: {},
      nearbyStores: [],
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Your Personalized Fitness Plan</Text>
      
      {renderMetrics()}
      {renderMetabolicInfo()}
      {renderNutritionRecommendations()}
      {renderWorkoutPlan()}
      {renderProgressTracking()}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.startWorkoutButton}
          onPress={handleStartWorkout}
        >
          <Text style={styles.startWorkoutButtonText}>Start Workout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mealPlanButton}
          onPress={handleCreateMealPlan}
        >
          <Text style={styles.mealPlanButtonText}>Create Meal Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back to Form</Text>
        </TouchableOpacity>
      </View>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
  },
  metricsContainer: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '48%',
    marginBottom: 15,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  metricSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  metabolicContainer: {
    marginBottom: 20,
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    padding: 15,
  },
  metabolicGrid: {
    gap: 15,
  },
  metabolicItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
  },
  metabolicLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  metabolicValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007bff',
  },
  metabolicSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  nutritionContainer: {
    marginBottom: 20,
    backgroundColor: '#e8f5e8',
    borderRadius: 10,
    padding: 15,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    width: '48%',
    marginBottom: 15,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  nutritionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
  },
  nutritionSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  workoutContainer: {
    marginBottom: 20,
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    padding: 15,
  },
  workoutSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  workoutDaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  workoutDayButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    marginBottom: 10,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  workoutDayButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  workoutDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  workoutDayTextSelected: {
    color: '#fff',
  },
  focusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 5,
  },
  focusBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  workoutDetails: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
  },
  workoutDetailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  workoutDuration: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  exercisesContainer: {
    gap: 10,
  },
  exercisesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  exerciseItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  exerciseDetails: {
    gap: 4,
  },
  exerciseDetail: {
    fontSize: 12,
    color: '#666',
  },
  trackingContainer: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  trackingGrid: {
    gap: 10,
  },
  trackingItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
  },
  trackingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  trackingValue: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    gap: 15,
    marginBottom: 40,
  },
  startWorkoutButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  startWorkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  mealPlanButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  mealPlanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#6c757d',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  weekSelector: {
    marginBottom: 15,
  },
  weekSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  weekButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  weekButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  weekButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  weekButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  weekButtonTextSelected: {
    color: '#fff',
  },
  circuitInfo: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 6,
    marginBottom: 15,
  },
  circuitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  warmupItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  warmupName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  warmupDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 5,
  },
  prescriptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
    marginTop: 5,
  },
  prescriptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  instructionsContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  instructionText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  tipsContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#856404',
  },
  tipText: {
    fontSize: 13,
    color: '#856404',
    marginBottom: 4,
    lineHeight: 20,
  },
});

export default FitnessPlanScreen; 