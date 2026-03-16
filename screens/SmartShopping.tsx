import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SmartShopping = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Shopping</Text>
      <Text style={styles.subtitle}>
        Compare grocery prices and build smarter carts. This feature is in development.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default SmartShopping;

