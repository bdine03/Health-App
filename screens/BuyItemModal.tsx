import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
} from 'react-native';

interface BuyItemModalProps {
  visible: boolean;
  onClose: () => void;
  item: any;
  onPurchase: (item: any, quantity: number, walmartProduct: any) => void;
}

const BuyItemModal = ({ visible, onClose, item, onPurchase }: BuyItemModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const selectedProduct = products[selectedIndex];

  useEffect(() => {
    if (visible) {
      // fetch location early
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          },
          () => {
            setCoords(null);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
        );
      }
    }
  }, [visible]);

  useEffect(() => {
    if (visible && item) {
      searchWalmartProducts();
    }
  }, [visible, item]);

  const searchWalmartProducts = async () => {
    if (!item) return;
    
    setIsSearching(true);
    try {
      const response = await fetch('http://localhost:5002/search-walmart-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: item.name,
          ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        }),
      });

      const data = await response.json();
      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
        setSelectedIndex(0);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error searching Walmart products:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePurchase = () => {
    if (quantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
      return;
    }

    onPurchase(item, quantity, selectedProduct);
    onClose();
  };

  const incrementQuantity = () => {
    setQuantity(prev => prev + 1);
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  if (!item) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Purchase Item</Text>
            
            {/* Item Details */}
            <View style={styles.itemSection}>
              <Text style={styles.sectionTitle}>Item Details</Text>
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

            {/* Walmart Products */}
            <View style={styles.walmartSection}>
              <Text style={styles.sectionTitle}>Walmart Products</Text>
              {isSearching ? (
                <>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.loadingText}>
                    {coords ? 'Searching nearby store...' : 'Searching products...'}
                  </Text>
                </>
              ) : products.length > 0 ? (
                products.map((p, idx) => (
                  <TouchableOpacity
                    key={p.itemId || idx}
                    style={[styles.productRow, idx === selectedIndex && styles.productRowSelected]}
                    onPress={() => setSelectedIndex(idx)}
                  >
                    {p.thumbnailImage ? (
                      <Image source={{ uri: p.thumbnailImage }} style={styles.productImage} resizeMode="contain" />
                    ) : (
                      <View style={[styles.productImage, { backgroundColor: '#eee' }]} />
                    )}
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                      <Text style={styles.productPrice}>
                        ${p.salePrice || p.msrp || '—'}
                      </Text>
                      <View style={styles.productBadges}>
                        {p.availableOnline && <Text style={styles.availableText}>Online</Text>}
                        {p.twoDayShippingEligible && <Text style={styles.shippingText}>2-Day</Text>}
                        {/* Simple health-aligned badge: prefer protein-forward or whole grain */}
                        {(() => {
                          const name = (p.name || '').toLowerCase();
                          const isWholeGrain = /whole\s*grain|whole\s*wheat|brown\s*rice|quinoa/.test(name);
                          const isLean = /lean|low\s*fat|skinless|light/.test(name);
                          const isYogurt = /greek\s*yogurt/.test(name);
                          const protein = item?.nutrition?.protein || 0;
                          const calories = item?.nutrition?.calories || 0;
                          const proteinDense = protein >= 15 && calories <= 350;
                          if (isWholeGrain || isLean || isYogurt || proteinDense) {
                            return <Text style={styles.healthBadge}>Goal-friendly</Text>;
                          }
                          return null;
                        })()}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noProductText}>
                  No matching products found {coords ? 'near you' : ''}.
                </Text>
              )}
            </View>

            {/* Quantity Selection */}
            <View style={styles.quantitySection}>
              <Text style={styles.sectionTitle}>Quantity</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={decrementQuantity}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.quantityInput}
                  value={quantity.toString()}
                  onChangeText={(text) => setQuantity(parseInt(text) || 1)}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={incrementQuantity}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Total Price */}
            {selectedProduct && (
              <View style={styles.totalSection}>
                <Text style={styles.sectionTitle}>Total Price</Text>
                <Text style={styles.totalPrice}>
                  ${(((selectedProduct.salePrice || selectedProduct.msrp) || 0) * quantity).toFixed(2)}
                </Text>
                {selectedProduct.productUrl && (
                  <TouchableOpacity
                    style={styles.viewOnlineButton}
                    onPress={() => Linking.openURL(selectedProduct.productUrl).catch(() => {
                      Alert.alert('Unable to open', 'Please try again later.');
                    })}
                  >
                    <Text style={styles.viewOnlineText}>View live availability on Walmart.com</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.purchaseButton]}
                onPress={handlePurchase}
                disabled={!selectedProduct}
              >
                <Text style={styles.purchaseButtonText}>
                  {isLoading ? 'Processing...' : selectedProduct ? 'Purchase' : 'Select a Product'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    marginBottom: 20,
    textAlign: 'center',
  },
  itemSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
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
  walmartSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    alignItems: 'center',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  productRowSelected: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  productImage: {
    width: 60,
    height: 60,
    marginRight: 15,
    borderRadius: 4,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 5,
  },
  productBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  availableText: {
    fontSize: 12,
    color: '#28a745',
    marginBottom: 2,
  },
  shippingText: {
    fontSize: 12,
    color: '#007AFF',
  },
  healthBadge: {
    fontSize: 12,
    color: '#fff',
    backgroundColor: '#28a745',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  noProductText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  quantitySection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    marginHorizontal: 15,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
  },
  totalSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    alignItems: 'center',
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
  },
  viewOnlineButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#004f9a',
  },
  viewOnlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 6,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  purchaseButton: {
    backgroundColor: '#28a745',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default BuyItemModal; 