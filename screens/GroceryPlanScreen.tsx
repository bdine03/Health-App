import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import BuyItemModal from './BuyItemModal';

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
};

type Props = NativeStackScreenProps<RootStackParamList, 'GroceryPlan'>;

const GroceryPlanScreen = ({ route, navigation }: Props) => {
  // Handle case where no params are passed (coming from OrderTracking reorder)
  const params = route.params || {};
  const {
    mealPlan = {},
    groceryList = [],
    totalItems = 0,
    totalBudget = '$0',
    remainingBudget = '$0',
    dailyNutritionTargets = {},
    totalNutrition = {},
    nearbyStores = [],
  } = params;

  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [autoStores, setAutoStores] = useState<any[]>([]);
  const [zipInput, setZipInput] = useState('');
  const [isFindingStores, setIsFindingStores] = useState(false);
  
  // Individual item purchase modal state
  const [buyItemModalVisible, setBuyItemModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const getMealTypeDisplayName = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return 'Breakfast';
      case 'lunch': return 'Lunch';
      case 'dinner': return 'Dinner';
      case 'snack1': return 'Snack 1';
      case 'snack2': return 'Snack 2';
      default: return mealType.charAt(0).toUpperCase() + mealType.slice(1);
    }
  };

  const getMealTypeColor = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return '#FF6B6B';
      case 'lunch': return '#4ECDC4';
      case 'dinner': return '#45B7D1';
      case 'snack1': return '#96CEB4';
      case 'snack2': return '#FFEAA7';
      default: return '#007AFF';
    }
  };

  const handleBuyAll = () => {
    if (nearbyStores && nearbyStores.length > 0) {
      setSelectedStore(nearbyStores[0]);
      setBuyModalVisible(true);
    } else {
      Alert.alert('No Stores Available', 'No nearby stores found for pickup orders.');
    }
  };

  const handleCreatePickupOrder = async () => {
    if (!userInfo.name || !userInfo.email || !userInfo.phone) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    setIsCreatingOrder(true);
    try {
      const response = await fetch('http://localhost:5002/create-pickup-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grocery_items: groceryList,
          user_info: userInfo,
          store_location: selectedStore,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert(
          'Order Created!',
          `Your pickup order has been created successfully!\n\nOrder ID: ${data.order.orderId}\nPickup Location: ${selectedStore.name}\nEstimated Pickup: ${data.order.estimatedPickupTime}\n\nYou'll receive a confirmation email shortly.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setBuyModalVisible(false);
                setUserInfo({ name: '', email: '', phone: '' });
              },
            },
          ]
        );
      } else {
        Alert.alert('Order Failed', data.error || 'Unable to create pickup order.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create pickup order. Please try again.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleBuyItem = (item: any) => {
    setSelectedItem(item);
    setBuyItemModalVisible(true);
  };

  useEffect(() => {
    // If no stores provided, try to auto-detect via geolocation
    if ((!nearbyStores || nearbyStores.length === 0) && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await fetchNearbyWalmartStores({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        async () => {
          // silently ignore; user can enter zip
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
    }
  }, []);

  const fetchNearbyWalmartStores = async (params: { latitude?: number; longitude?: number; zip_code?: string }) => {
    setIsFindingStores(true);
    try {
      const response = await fetch('http://localhost:5002/nearby-walmart-stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.stores)) {
        const mapped = data.stores.map((s: any) => ({
          name: s.name,
          address: s.address,
          distance: s.distance_km,
          rating: s.rating,
          is_open: s.is_open,
          phone: s.phone,
          store_id: s.store_id,
        }));
        setAutoStores(mapped);
      } else {
        setAutoStores([]);
      }
    } catch (e) {
      setAutoStores([]);
    } finally {
      setIsFindingStores(false);
    }
  };

  const handleItemPurchase = (item: any, quantity: number, walmartProduct: any) => {
    Alert.alert(
      'Purchase Successful!',
      `You've purchased ${quantity}x ${item.name} for $${((walmartProduct?.salePrice || walmartProduct?.msrp || 0) * quantity).toFixed(2)}.\n\nYou'll receive a confirmation email shortly.`,
      [{ text: 'OK' }]
    );
  };

  const renderMealPlan = () => {
    return Object.entries(mealPlan).map(([day, meals]: [string, any]) => (
      <View key={day} style={styles.dayContainer}>
        <Text style={styles.dayTitle}>Day {parseInt(day) + 1}</Text>
        {Object.entries(meals).map(([mealType, items]: [string, any]) => (
          <View key={mealType} style={styles.mealContainer}>
            <View style={[styles.mealHeader, { backgroundColor: getMealTypeColor(mealType) }]}>
              <Text style={styles.mealTitle}>
                {getMealTypeDisplayName(mealType)}
              </Text>
            </View>
            {items.length === 0 ? (
              <Text style={styles.emptyMealText}>No items planned</Text>
            ) : (
              items.map((item: any, index: number) => (
                <View key={index} style={styles.mealItem}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDetails}>
                    {item.quantity} - {item.estimated_price}
                  </Text>
                  <View style={styles.nutritionRow}>
                    <Text style={styles.nutritionText}>
                      Calories: {Math.round(item.nutrition.calories)} kcal
                    </Text>
                    <Text style={styles.nutritionText}>
                      Protein: {Math.round(item.nutrition.protein)}g
                    </Text>
                  </View>
                  <View style={styles.nutritionRow}>
                    <Text style={styles.nutritionText}>
                      Carbs: {Math.round(item.nutrition.carbs)}g
                    </Text>
                    <Text style={styles.nutritionText}>
                      Fat: {Math.round(item.nutrition.fat)}g
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ))}
      </View>
    ));
  };

  const renderGroceryList = () => {
    return (
      <View style={styles.groceryListContainer}>
        <View style={styles.groceryHeader}>
          <Text style={styles.sectionTitle}>Grocery List</Text>
          <TouchableOpacity style={styles.buyAllButton} onPress={handleBuyAll}>
            <Text style={styles.buyAllButtonText}>Buy All</Text>
          </TouchableOpacity>
        </View>
        {groceryList.map((item, index) => (
          <View key={index} style={styles.groceryItem}>
            <View style={styles.groceryItemHeader}>
              <Text style={styles.itemName}>{item.name}</Text>
              <TouchableOpacity 
                style={styles.buyButton}
                onPress={() => handleBuyItem(item)}
              >
                <Text style={styles.buyButtonText}>Buy</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.itemDetails}>
              {item.quantity} - {item.estimated_price}
            </Text>
            <View style={styles.nutritionRow}>
              <Text style={styles.nutritionText}>
                Calories: {Math.round(item.nutrition.calories)} kcal
              </Text>
              <Text style={styles.nutritionText}>
                Protein: {Math.round(item.nutrition.protein)}g
              </Text>
            </View>
            <View style={styles.nutritionRow}>
              <Text style={styles.nutritionText}>
                Carbs: {Math.round(item.nutrition.carbs)}g
              </Text>
              <Text style={styles.nutritionText}>
                Fat: {Math.round(item.nutrition.fat)}g
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderNutritionSummary = () => {
    return (
      <View style={styles.nutritionContainer}>
        <Text style={styles.sectionTitle}>Daily Nutrition Targets</Text>
        <View style={styles.nutritionGrid}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Daily Calories</Text>
            <Text style={styles.nutritionValue}>{Math.round(dailyNutritionTargets.calories)} kcal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Protein</Text>
            <Text style={styles.nutritionValue}>{Math.round(dailyNutritionTargets.protein)}g</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Carbs</Text>
            <Text style={styles.nutritionValue}>{Math.round(dailyNutritionTargets.carbs)}g</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Fat</Text>
            <Text style={styles.nutritionValue}>{Math.round(dailyNutritionTargets.fat)}g</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTotalNutrition = () => {
    return (
      <View style={styles.totalNutritionContainer}>
        <Text style={styles.sectionTitle}>Total Weekly Nutrition</Text>
        <View style={styles.nutritionGrid}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Total Calories</Text>
            <Text style={styles.nutritionValue}>{Math.round(totalNutrition.calories)} kcal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Total Protein</Text>
            <Text style={styles.nutritionValue}>{Math.round(totalNutrition.protein)}g</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Total Carbs</Text>
            <Text style={styles.nutritionValue}>{Math.round(totalNutrition.carbs)}g</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>Total Fat</Text>
            <Text style={styles.nutritionValue}>{Math.round(totalNutrition.fat)}g</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderNearbyStores = () => {
    const combinedStores = [
      ...(autoStores || []),
      ...((nearbyStores && nearbyStores.length > 0) ? nearbyStores : []),
    ];

    return (
      <View style={styles.storesContainer}>
        <Text style={styles.sectionTitle}>Nearby Walmart Stores</Text>
        <View style={{ marginBottom: 10 }}>
          <TextInput
            style={styles.input}
            placeholder="Enter ZIP code (optional)"
            value={zipInput}
            onChangeText={setZipInput}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={[styles.buyAllButton, { backgroundColor: '#007AFF', alignSelf: 'flex-start' }]}
            onPress={() => {
              if (zipInput.trim().length >= 4) {
                fetchNearbyWalmartStores({ zip_code: zipInput.trim() });
              } else {
                Alert.alert('Invalid ZIP', 'Please enter a valid ZIP code.');
              }
            }}
          >
            <Text style={styles.buyAllButtonText}>{isFindingStores ? 'Finding...' : 'Find Stores'}</Text>
          </TouchableOpacity>
          {isFindingStores && <ActivityIndicator style={{ marginTop: 8 }} color="#007AFF" />}
        </View>
        {combinedStores.length === 0 ? (
          <Text style={styles.emptyMealText}>No stores yet. Enter a ZIP or enable location.</Text>
        ) : combinedStores.map((store, index) => (
          <View key={index} style={styles.storeItem}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeDetails}>{store.address}</Text>
            <View style={styles.storeInfo}>
              <Text style={styles.storeInfoText}>
                {store.distance} km away • {store.is_open ? 'Open' : 'Closed'}
              </Text>
              {store.rating && (
                <Text style={styles.storeInfoText}>
                  Rating: {store.rating} ⭐
                </Text>
              )}
            </View>
            {store.phone && (
              <Text style={styles.storePhone}>{store.phone}</Text>
            )}
            {store.store_id && (
              <TouchableOpacity
                style={[styles.buyAllButton, { marginTop: 8, alignSelf: 'flex-start' }]}
                onPress={() => {
                  const url = `https://www.walmart.com/store/${store.store_id}`;
                  Linking.openURL(url).catch(() => Alert.alert('Unable to open', 'Please try again later.'));
                }}
              >
                <Text style={styles.buyAllButtonText}>View Store on Walmart.com</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Your 7-Day Meal Plan</Text>
      
      {renderNutritionSummary()}
      {renderTotalNutrition()}
      
      <View style={styles.budgetContainer}>
        <Text style={styles.budgetText}>Total Budget: {totalBudget}</Text>
        <Text style={styles.budgetText}>Remaining: {remainingBudget}</Text>
        <Text style={styles.budgetText}>Total Items: {totalItems}</Text>
      </View>

      {renderMealPlan()}
      {renderGroceryList()}
      {renderNearbyStores()}

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Back to Form</Text>
      </TouchableOpacity>

      {/* Buy All Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={buyModalVisible}
        onRequestClose={() => setBuyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Pickup Order</Text>
            
            {selectedStore && (
              <View style={styles.storeSelection}>
                <Text style={styles.modalSubtitle}>Pickup Location:</Text>
                <Text style={styles.storeName}>{selectedStore.name}</Text>
                <Text style={styles.storeAddress}>{selectedStore.address}</Text>
              </View>
            )}

            <Text style={styles.modalSubtitle}>Your Information:</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={userInfo.name}
              onChangeText={(text) => setUserInfo({ ...userInfo, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={userInfo.email}
              onChangeText={(text) => setUserInfo({ ...userInfo, email: text })}
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={userInfo.phone}
              onChangeText={(text) => setUserInfo({ ...userInfo, phone: text })}
              keyboardType="phone-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setBuyModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, isCreatingOrder && styles.disabledButton]}
                onPress={handleCreatePickupOrder}
                disabled={isCreatingOrder}
              >
                <Text style={styles.confirmButtonText}>
                  {isCreatingOrder ? 'Creating Order...' : 'Create Order'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Individual Item Purchase Modal */}
      <BuyItemModal
        visible={buyItemModalVisible}
        onClose={() => setBuyItemModalVisible(false)}
        item={selectedItem}
        onPurchase={handleItemPurchase}
      />
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
    marginBottom: 10,
  },
  dayContainer: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  mealContainer: {
    marginBottom: 15,
  },
  mealHeader: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyMealText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 10,
  },
  mealItem: {
    marginLeft: 10,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  nutritionText: {
    fontSize: 12,
    color: '#666',
  },
  groceryListContainer: {
    marginTop: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  groceryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  buyAllButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buyAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  groceryItem: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groceryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  buyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  nutritionContainer: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  totalNutritionContainer: {
    marginBottom: 20,
    backgroundColor: '#e3f2fd',
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
    marginBottom: 10,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  budgetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  budgetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  backButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  storesContainer: {
    marginTop: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  storeItem: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  storeDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  storeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  storeInfoText: {
    fontSize: 12,
    color: '#666',
  },
  storePhone: {
    fontSize: 12,
    color: '#007AFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
  },
  storeSelection: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 6,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  confirmButton: {
    backgroundColor: '#28a745',
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default GroceryPlanScreen;
