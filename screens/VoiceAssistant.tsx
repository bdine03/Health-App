import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  TextInput,
  Platform,
} from 'react-native';

interface VoiceCommand {
  audio_text: string;
  user_id: string;
  context?: any;
}

interface VoiceResponse {
  success: boolean;
  message: string;
  data?: any;
  voice_response?: string;
  suggestions?: string[];
  error?: string;
}

interface CommandSuggestion {
  category: string;
  commands: string[];
  description: string;
  icon: string;
}

const VoiceAssistant = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceHistory, setVoiceHistory] = useState<Array<{ command: string; response: VoiceResponse }>>([]);
  const [currentCommand, setCurrentCommand] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [textInput, setTextInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const commandSuggestions: CommandSuggestion[] = [
    {
      category: 'meal_planning',
      commands: [
        'Create meal plan',
        'What should I eat',
        'Generate recipes',
        'Plan dinner',
        'Meal suggestions',
      ],
      description: 'Plan and generate meals',
      icon: '🍽️',
    },
    {
      category: 'workout_tracking',
      commands: [
        'Start workout',
        'End workout',
        'Log exercise',
        'Track reps',
        'Workout complete',
      ],
      description: 'Track your fitness activities',
      icon: '💪',
    },
    {
      category: 'nutrition_tracking',
      commands: [
        'Log breakfast',
        'Log lunch',
        'Log dinner',
        'Log snack',
        'Track calories',
      ],
      description: 'Log your nutrition intake',
      icon: '🥗',
    },
    {
      category: 'progress_check',
      commands: [
        'Check progress',
        'How am I doing',
        'Weight update',
        'Fitness status',
        'Show achievements',
      ],
      description: 'Check your progress and stats',
      icon: '📊',
    },
    {
      category: 'shopping',
      commands: [
        'Add to grocery list',
        'Buy groceries',
        'Find deals',
        'Shopping list',
        'Order food',
      ],
      description: 'Manage your shopping',
      icon: '🛒',
    },
  ];

  const startListening = () => {
    setIsListening(true);
    setError(null);
    // Note: For full voice recognition, you would need to install @react-native-voice/voice
    // For now, we'll show a message and allow text input as fallback
    Alert.alert(
      'Voice Recognition',
      'Voice recognition requires additional setup. Please use the text input below or tap a command button to try a demo command.',
      [
        { text: 'OK', onPress: () => setIsListening(false) }
      ]
    );
  };

  const stopListening = () => {
    setIsListening(false);
    setCurrentCommand('');
  };

  const processVoiceCommand = async (command: string) => {
    if (!command || command.trim().length === 0) {
      setError('Please enter a command');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentCommand(command);
    
    try {
      const voiceCommand: VoiceCommand = {
        audio_text: command.trim(),
        user_id: 'current_user',
        context: {
          last_meal: 'breakfast',
          current_workout: null,
        },
      };

      const response = await fetch('http://localhost:5002/voice-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(voiceCommand),
        timeout: 10000, // 10 second timeout
      } as any);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const data: VoiceResponse = await response.json();
      
      // Add to history
      setVoiceHistory(prev => [
        { command: command.trim(), response: data },
        ...prev.slice(0, 9), // Keep last 10 commands
      ]);

      if (data.success) {
        Alert.alert(
          'Voice Assistant',
          data.voice_response || data.message,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Voice Assistant', data.message || 'Command could not be processed');
      }
    } catch (error: any) {
      console.error('Voice command error:', error);
      
      // Use mock response if API fails (for demo purposes)
      const mockResponse: VoiceResponse = getMockResponseForCommand(command.trim());
      
      setVoiceHistory(prev => [
        { command: command.trim(), response: mockResponse },
        ...prev.slice(0, 9),
      ]);

      const errorMessage = error.message || 'Connection failed';
      setError(`Backend unavailable. Using demo response. (${errorMessage})`);
      
      Alert.alert(
        'Voice Assistant (Demo Mode)',
        mockResponse.voice_response || mockResponse.message,
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
      setIsListening(false);
      setCurrentCommand('');
      setTextInput('');
    }
  };

  const getMockResponseForCommand = (command: string): VoiceResponse => {
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('meal') || lowerCommand.includes('eat') || lowerCommand.includes('recipe')) {
      return {
        success: true,
        message: 'Meal plan generated',
        voice_response: `I've created a personalized meal plan for you with 3 meals totaling 1350 calories. The plan includes a Protein Smoothie Bowl for breakfast, Grilled Chicken Salad for lunch, and Salmon with Quinoa for dinner.`,
        data: {
          meal_plan: {
            meals: [
              { name: 'Protein Smoothie Bowl', calories: 350, type: 'breakfast' },
              { name: 'Grilled Chicken Salad', calories: 450, type: 'lunch' },
              { name: 'Salmon with Quinoa', calories: 550, type: 'dinner' },
            ],
            total_calories: 1350,
          },
        },
      };
    } else if (lowerCommand.includes('workout') || lowerCommand.includes('exercise') || lowerCommand.includes('start')) {
      return {
        success: true,
        message: 'Workout session started',
        voice_response: `Workout started! I'm tracking your strength training session. Remember to warm up for 5 minutes and cool down afterward.`,
        data: {
          session_id: `session_${Date.now()}`,
          workout_type: 'strength training',
          start_time: new Date().toISOString(),
        },
      };
    } else if (lowerCommand.includes('log') || lowerCommand.includes('track') || lowerCommand.includes('breakfast') || lowerCommand.includes('lunch') || lowerCommand.includes('dinner')) {
      return {
        success: true,
        message: 'Nutrition logged',
        voice_response: `I've logged your meal. You've consumed approximately 450 calories. Keep tracking to meet your daily nutrition goals!`,
        data: {
          food_name: 'Meal',
          calories: 450,
          logged_at: new Date().toISOString(),
        },
      };
    } else if (lowerCommand.includes('progress') || lowerCommand.includes('weight') || lowerCommand.includes('status')) {
      return {
        success: true,
        message: 'Progress retrieved',
        voice_response: `Great progress! You're 75% toward your goal. You've lost 8.5 pounds and completed 15 workouts this month. Keep up the excellent work!`,
        data: {
          completion_percentage: 75,
          weight_lost: 8.5,
          workouts_completed: 15,
        },
      };
    } else if (lowerCommand.includes('shop') || lowerCommand.includes('grocery') || lowerCommand.includes('buy')) {
      return {
        success: true,
        message: 'Shopping list updated',
        voice_response: `I've added the items to your grocery list. You now have 12 items. Would you like me to find the best deals at nearby stores?`,
        data: {
          total_items: 12,
          added_at: new Date().toISOString(),
        },
      };
    } else {
      return {
        success: true,
        message: 'Command processed',
        voice_response: `I've processed your request: "${command}". I can help you with meal planning, workout tracking, nutrition logging, progress checking, and shopping. Try saying "Create meal plan" or "Start workout" for more specific help.`,
        data: {},
      };
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim().length > 0) {
      processVoiceCommand(textInput);
    }
  };

  const executeDemoCommand = (command: string) => {
    setCurrentCommand(command);
    processVoiceCommand(command);
  };

  const renderCommandSuggestion = (suggestion: CommandSuggestion) => (
    <View style={styles.suggestionCard}>
      <View style={styles.suggestionHeader}>
        <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
        <Text style={styles.suggestionCategory}>{suggestion.description}</Text>
      </View>
      
      <View style={styles.commandsList}>
        {suggestion.commands.map((command, index) => (
          <TouchableOpacity
            key={index}
            style={styles.commandButton}
            onPress={() => executeDemoCommand(command)}
          >
            <Text style={styles.commandText}>"{command}"</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderVoiceHistory = () => {
    if (voiceHistory.length === 0) return null;

    return (
      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>Recent Commands</Text>
        {voiceHistory.map((item, index) => (
          <View key={index} style={styles.historyItem}>
            <View style={styles.historyCommand}>
              <Text style={styles.historyLabel}>You said:</Text>
              <Text style={styles.historyCommandText}>"{item.command}"</Text>
            </View>
            
            <View style={styles.historyResponse}>
              <Text style={styles.historyLabel}>Assistant:</Text>
              <Text style={styles.historyResponseText}>
                {item.response.voice_response || item.response.message}
              </Text>
            </View>
            
            {item.response.success && (
              <View style={styles.historyStatus}>
                <Text style={styles.historyStatusText}>✅ Success</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderVoiceButton = () => (
    <View style={styles.voiceButtonContainer}>
      <TouchableOpacity
        style={[
          styles.voiceButton,
          isListening && styles.voiceButtonListening,
          isProcessing && styles.voiceButtonProcessing,
        ]}
        onPress={isListening ? stopListening : startListening}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <Text style={styles.voiceButtonIcon}>
            {isListening ? '🔴' : '🎤'}
          </Text>
        )}
      </TouchableOpacity>
      
      <Text style={styles.voiceButtonLabel}>
        {isListening ? 'Listening...' : isProcessing ? 'Processing...' : 'Tap to speak'}
      </Text>
      
      {currentCommand && (
        <Text style={styles.currentCommand}>
          "{currentCommand}"
        </Text>
      )}
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.quickActionsTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => executeDemoCommand('Create meal plan')}
        >
          <Text style={styles.quickActionIcon}>🍽️</Text>
          <Text style={styles.quickActionText}>Meal Plan</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => executeDemoCommand('Start workout')}
        >
          <Text style={styles.quickActionIcon}>💪</Text>
          <Text style={styles.quickActionText}>Start Workout</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => executeDemoCommand('Log breakfast')}
        >
          <Text style={styles.quickActionIcon}>🥗</Text>
          <Text style={styles.quickActionText}>Log Meal</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => executeDemoCommand('Check progress')}
        >
          <Text style={styles.quickActionIcon}>📊</Text>
          <Text style={styles.quickActionText}>Progress</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const filteredSuggestions = selectedCategory === 'all' 
    ? commandSuggestions 
    : commandSuggestions.filter(s => s.category === selectedCategory);

  const categories = [
    { key: 'all', label: 'All Commands' },
    { key: 'meal_planning', label: 'Meal Planning' },
    { key: 'workout_tracking', label: 'Workout Tracking' },
    { key: 'nutrition_tracking', label: 'Nutrition' },
    { key: 'progress_check', label: 'Progress' },
    { key: 'shopping', label: 'Shopping' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Voice Assistant</Text>
      <Text style={styles.subtitle}>
        Use voice commands to interact with Healthify
      </Text>

      {renderVoiceButton()}

      {/* Text Input Fallback */}
      <View style={styles.textInputContainer}>
        <Text style={styles.textInputLabel}>Or type your command:</Text>
        <View style={styles.textInputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Create meal plan, Start workout..."
            value={textInput}
            onChangeText={setTextInput}
            onSubmitEditing={handleTextSubmit}
            editable={!isProcessing}
            multiline={false}
          />
          <TouchableOpacity
            style={[styles.submitButton, isProcessing && styles.submitButtonDisabled]}
            onPress={handleTextSubmit}
            disabled={isProcessing || !textInput.trim()}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>

      {renderQuickActions()}

      <View style={styles.categoryTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map(category => (
            <TouchableOpacity
              key={category.key}
              style={[
                styles.categoryTab,
                selectedCategory === category.key && styles.selectedCategoryTab,
              ]}
              onPress={() => setSelectedCategory(category.key)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  selectedCategory === category.key && styles.selectedCategoryTabText,
                ]}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.suggestionsContainer}>
        <Text style={styles.suggestionsTitle}>Try These Commands</Text>
        {filteredSuggestions.map((suggestion, index) => (
          <View key={index} style={styles.suggestionContainer}>
            {renderCommandSuggestion(suggestion)}
          </View>
        ))}
      </View>

      {renderVoiceHistory()}

      <View style={styles.helpContainer}>
        <Text style={styles.helpTitle}>💡 Voice Assistant Tips</Text>
        <Text style={styles.helpText}>
          • Type your command in the text input above or tap a command button
        </Text>
        <Text style={styles.helpText}>
          • Use natural language like "Create meal plan" or "Start workout"
        </Text>
        <Text style={styles.helpText}>
          • You can ask about meal plans, workouts, progress, and shopping
        </Text>
        <Text style={styles.helpText}>
          • If the backend is unavailable, demo responses will be provided
        </Text>
        <Text style={styles.helpText}>
          • Voice recognition requires additional setup (see command buttons for quick access)
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
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
  voiceButtonContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  voiceButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  voiceButtonListening: {
    backgroundColor: '#ff4444',
    transform: [{ scale: 1.1 }],
  },
  voiceButtonProcessing: {
    backgroundColor: '#ff9800',
  },
  voiceButtonIcon: {
    fontSize: 32,
  },
  voiceButtonLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  currentCommand: {
    fontSize: 14,
    color: '#007AFF',
    fontStyle: 'italic',
  },
  quickActionsContainer: {
    marginBottom: 30,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  categoryTabs: {
    marginBottom: 20,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  selectedCategoryTab: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryTabText: {
    fontSize: 14,
    color: '#666',
  },
  selectedCategoryTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  suggestionsContainer: {
    marginBottom: 30,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  suggestionContainer: {
    marginBottom: 15,
  },
  suggestionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  suggestionCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  commandsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  commandButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  commandText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  historyContainer: {
    marginBottom: 30,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  historyItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  historyCommand: {
    marginBottom: 8,
  },
  historyLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  historyCommandText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyResponse: {
    marginBottom: 8,
  },
  historyResponseText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  historyStatus: {
    alignItems: 'flex-end',
  },
  historyStatusText: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '600',
  },
  helpContainer: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 5,
    lineHeight: 20,
  },
  textInputContainer: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  textInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    ...Platform.select({
      ios: {
        paddingVertical: 12,
      },
    }),
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default VoiceAssistant; 