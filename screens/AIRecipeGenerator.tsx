import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import CheckBox from '@react-native-community/checkbox';

interface Recipe {
  name: string;
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
  };
  prep_time: number;
  cook_time: number;
  difficulty: string;
  servings: number;
  tags: string[];
}

const AIRecipeGenerator = () => {
  const [availableIngredients, setAvailableIngredients] = useState<string>('');
  const [mealType, setMealType] = useState<string>('lunch');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [fitnessGoal, setFitnessGoal] = useState<string>('weight_loss');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);

  const mealTypes = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
    { value: 'snack', label: 'Snack' },
  ];

  const fitnessGoals = [
    { value: 'weight_loss', label: 'Weight Loss' },
    { value: 'muscle_gain', label: 'Muscle Gain' },
    { value: 'maintenance', label: 'Maintenance' },
  ];

  const dietaryOptions = [
    'vegetarian',
    'vegan',
    'gluten-free',
    'dairy-free',
    'low-carb',
    'high-protein',
  ];

  const toggleDietaryRestriction = (restriction: string) => {
    setDietaryRestrictions(prev =>
      prev.includes(restriction)
        ? prev.filter(r => r !== restriction)
        : [...prev, restriction]
    );
  };

  const generateRecipe = async () => {
    if (!availableIngredients.trim()) {
      Alert.alert('Error', 'Please enter available ingredients');
      return;
    }

    setIsLoading(true);
    try {
      const ingredientsList = availableIngredients
        .split(',')
        .map(ingredient => ingredient.trim())
        .filter(ingredient => ingredient.length > 0);

      const response = await fetch('http://localhost:5002/generate-ai-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          available_ingredients: ingredientsList,
          meal_type: mealType,
          dietary_restrictions: dietaryRestrictions,
          fitness_goal: fitnessGoal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate recipe');
      }

      const data = await response.json();
      if (data.success) {
        setGeneratedRecipe(data.recipe);
      } else {
        throw new Error(data.error || 'Failed to generate recipe');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const renderRecipe = () => {
    if (!generatedRecipe) return null;

    return (
      <View style={styles.recipeContainer}>
        <Text style={styles.recipeTitle}>{generatedRecipe.name}</Text>
        
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeInfoText}>
            Prep: {generatedRecipe.prep_time} min | Cook: {generatedRecipe.cook_time} min
          </Text>
          <Text style={styles.recipeInfoText}>
            Difficulty: {generatedRecipe.difficulty} | Servings: {generatedRecipe.servings}
          </Text>
        </View>

        <View style={styles.nutritionContainer}>
          <Text style={styles.sectionTitle}>Nutrition (per serving)</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{generatedRecipe.nutrition.calories}</Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{generatedRecipe.nutrition.protein_g}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{generatedRecipe.nutrition.carbs_g}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{generatedRecipe.nutrition.fat_g}g</Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          </View>
        </View>

        <View style={styles.ingredientsContainer}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {generatedRecipe.ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.ingredientItem}>
              • {ingredient}
            </Text>
          ))}
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {generatedRecipe.instructions.map((instruction, index) => (
            <Text key={index} style={styles.instructionItem}>
              {index + 1}. {instruction}
            </Text>
          ))}
        </View>

        <View style={styles.tagsContainer}>
          {generatedRecipe.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>AI Recipe Generator</Text>
      <Text style={styles.subtitle}>
        Generate unique recipes based on your available ingredients and preferences
      </Text>

      <View style={styles.inputSection}>
        <Text style={styles.label}>Available Ingredients (comma-separated)</Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={4}
          value={availableIngredients}
          onChangeText={setAvailableIngredients}
          placeholder="e.g., chicken breast, broccoli, quinoa, olive oil..."
        />
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.label}>Meal Type</Text>
        <View style={styles.optionsContainer}>
          {mealTypes.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.optionButton,
                mealType === type.value && styles.selectedOption,
              ]}
              onPress={() => setMealType(type.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  mealType === type.value && styles.selectedOptionText,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.label}>Fitness Goal</Text>
        <View style={styles.optionsContainer}>
          {fitnessGoals.map(goal => (
            <TouchableOpacity
              key={goal.value}
              style={[
                styles.optionButton,
                fitnessGoal === goal.value && styles.selectedOption,
              ]}
              onPress={() => setFitnessGoal(goal.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  fitnessGoal === goal.value && styles.selectedOptionText,
                ]}
              >
                {goal.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.label}>Dietary Restrictions</Text>
        <View style={styles.checkboxContainer}>
          {dietaryOptions.map(option => (
            <View key={option} style={styles.checkboxRow}>
              <CheckBox
                value={dietaryRestrictions.includes(option)}
                onValueChange={() => toggleDietaryRestriction(option)}
              />
              <Text style={styles.checkboxLabel}>
                {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.generateButton, isLoading && styles.generateButtonDisabled]}
        onPress={generateRecipe}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateButtonText}>Generate Recipe</Text>
        )}
      </TouchableOpacity>

      {renderRecipe()}
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputSection: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  selectedOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  selectedOptionText: {
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
    color: '#333',
  },
  generateButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  recipeContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  recipeInfo: {
    marginBottom: 20,
  },
  recipeInfoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  nutritionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  ingredientsContainer: {
    marginBottom: 20,
  },
  ingredientItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 6,
    lineHeight: 22,
  },
  instructionsContainer: {
    marginBottom: 20,
  },
  instructionItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
});

export default AIRecipeGenerator; 