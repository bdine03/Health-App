import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  GroceryPlan: any;
  OrderTracking: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'OrderTracking'>;

interface Order {
  orderId: string;
  items: any[];
  totalPrice: number;
  pickupLocation: any;
  estimatedPickupTime: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  createdAt: string;
  userInfo: any;
}

const OrderTrackingScreen = ({ navigation }: Props) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Get user location (for nearest Walmart in Maps)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (error) => {
          console.warn('Location error:', error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }
  }, []);

  // Mock orders for demonstration (address will be shown via Maps action)
  const mockOrders: Order[] = [
    {
      orderId: 'WM-1703123456',
      items: [
        { name: 'Organic Bananas', quantity: 2, price: 3.98 },
        { name: 'Greek Yogurt', quantity: 1, price: 4.99 },
        { name: 'Chicken Breast', quantity: 1, price: 8.99 },
      ],
      totalPrice: 17.96,
      pickupLocation: {
        name: 'Walmart Supercenter',
        address: 'Nearest to your location',
      },
      estimatedPickupTime: '2023-12-21 14:30',
      status: 'ready',
      createdAt: '2023-12-21 10:30',
      userInfo: { name: 'John Doe', email: 'john@example.com' },
    },
    {
      orderId: 'WM-1703123457',
      items: [
        { name: 'Whole Grain Bread', quantity: 1, price: 2.99 },
        { name: 'Almond Milk', quantity: 1, price: 3.49 },
      ],
      totalPrice: 6.48,
      pickupLocation: {
        name: 'Walmart Neighborhood Market',
        address: 'Nearest to your location',
      },
      estimatedPickupTime: '2023-12-22 16:00',
      status: 'preparing',
      createdAt: '2023-12-21 11:45',
      userInfo: { name: 'John Doe', email: 'john@example.com' },
    },
  ];

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setRefreshing(true);
    try {
      // In a real app, this would fetch from your backend
      // For now, we'll use mock data
      setTimeout(() => {
        setOrders(mockOrders);
        setRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Error loading orders:', error);
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'confirmed': return '#17a2b8';
      case 'preparing': return '#007bff';
      case 'ready': return '#28a745';
      case 'completed': return '#6c757d';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready for Pickup';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            setOrders(prev => prev.map(order => 
              order.orderId === orderId 
                ? { ...order, status: 'cancelled' as const }
                : order
            ));
          },
        },
      ]
    );
  };

  const handleReorder = (order: Order) => {
    Alert.alert(
      'Reorder',
      'Would you like to reorder these items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reorder',
          onPress: () => {
            // Navigate back to grocery plan with the items
            navigation.navigate('GroceryPlan', {
              mealPlan: {},
              groceryList: order.items.map(item => ({
                name: item.name,
                quantity: item.quantity.toString(),
                estimated_price: `$${item.price}`,
                nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 }
              })),
              totalItems: order.items.length,
              totalBudget: `$${order.totalPrice}`,
              remainingBudget: '$0',
              dailyNutritionTargets: {},
              totalNutrition: {},
              nearbyStores: [order.pickupLocation],
            });
          },
        },
      ]
    );
  };

  const openNearestWalmartInMaps = () => {
    const { latitude, longitude } = coords || { latitude: 0, longitude: 0 };
    // Fallback: open generic search if coords not available
    const appleMapsUrl = coords
      ? `http://maps.apple.com/?q=Walmart&ll=${latitude},${longitude}`
      : `http://maps.apple.com/?q=Walmart+near+me`;
    const androidUrl = coords
      ? `geo:${latitude},${longitude}?q=Walmart`
      : `geo:0,0?q=Walmart`;
    const url = Platform.OS === 'ios' ? appleMapsUrl : androidUrl;
    Linking.openURL(url).catch(() => {
      Alert.alert('Maps Error', 'Unable to open the Maps app.');
    });
  };

  const renderOrder = (order: Order) => (
    <View key={order.orderId} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Order #{order.orderId}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <Text style={styles.orderDate}>
          Ordered: {new Date(order.createdAt).toLocaleDateString()}
        </Text>
        <Text style={styles.pickupTime}>
          Pickup: {new Date(order.estimatedPickupTime).toLocaleString()}
        </Text>
        <Text style={styles.totalPrice}>Total: ${order.totalPrice.toFixed(2)}</Text>
      </View>

      <View style={styles.pickupLocation}>
        <Text style={styles.locationTitle}>Pickup Location:</Text>
        <Text style={styles.locationName}>{order.pickupLocation.name}</Text>
        <Text style={styles.locationAddress}>
          {coords ? 'Nearest Walmart based on your location' : 'Locating nearest Walmart...'}
        </Text>
        <TouchableOpacity style={styles.mapsButton} onPress={openNearestWalmartInMaps}>
          <Text style={styles.mapsButtonText}>Open Nearest Walmart in Maps</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.itemsContainer}>
        <Text style={styles.itemsTitle}>Items ({order.items.length}):</Text>
        {order.items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemQuantity}>x{item.quantity}</Text>
            <Text style={styles.itemPrice}>${item.price}</Text>
          </View>
        ))}
      </View>

      <View style={styles.orderActions}>
        {order.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => handleCancelOrder(order.orderId)}
          >
            <Text style={styles.cancelButtonText}>Cancel Order</Text>
          </TouchableOpacity>
        )}
        
        {order.status === 'ready' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.pickupButton]}
            onPress={() => Alert.alert('Pickup', 'Please show your order ID at the pickup counter.')}
          >
            <Text style={styles.pickupButtonText}>Pickup Instructions</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.reorderButton]}
          onPress={() => handleReorder(order)}
        >
          <Text style={styles.reorderButtonText}>Reorder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Order Tracking</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadOrders}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadOrders} />
        }
      >
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No orders found</Text>
            <Text style={styles.emptyStateSubtext}>
              Your purchase history will appear here
            </Text>
          </View>
        ) : (
          orders.map(renderOrder)
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  orderId: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: 15,
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  pickupTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  pickupLocation: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
  },
  mapsButton: {
    marginTop: 10,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  mapsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  itemsContainer: {
    marginBottom: 20,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 10,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#dc3545',
  },
  pickupButton: {
    backgroundColor: '#28a745',
  },
  reorderButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pickupButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  reorderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
  },
  backButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default OrderTrackingScreen; 