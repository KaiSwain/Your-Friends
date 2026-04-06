import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  SafeAreaView,
} from 'react-native';
import { friendsAPI } from '../services/api';

export default function FriendsScreen() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFriend, setEditingFriend] = useState(null);
  const [friendForm, setFriendForm] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Load friends on component mount
  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await friendsAPI.getFriends();
      setFriends(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load friends');
      console.error('Load friends error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveFriend = async () => {
    try {
      if (editingFriend) {
        // Update existing friend
        await friendsAPI.updateFriend(editingFriend.id, friendForm);
      } else {
        // Create new friend
        await friendsAPI.addFriend(friendForm);
      }
      
      // Reload the list
      await loadFriends();
      
      // Close modal and reset form
      setModalVisible(false);
      resetForm();
      
      Alert.alert('Success', editingFriend ? 'Friend updated!' : 'Friend added!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save friend');
      console.error('Save friend error:', error);
    }
  };

  const deleteFriend = async (friend) => {
    Alert.alert(
      'Delete Friend',
      `Are you sure you want to delete ${friend.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await friendsAPI.deleteFriend(friend.id);
              await loadFriends();
              Alert.alert('Success', 'Friend deleted!');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete friend');
              console.error('Delete friend error:', error);
            }
          },
        },
      ]
    );
  };

  const openAddModal = () => {
    resetForm();
    setEditingFriend(null);
    setModalVisible(true);
  };

  const openEditModal = (friend) => {
    setFriendForm({
      name: friend.name,
      email: friend.email,
      phone: friend.phone,
    });
    setEditingFriend(friend);
    setModalVisible(true);
  };

  const resetForm = () => {
    setFriendForm({ name: '', email: '', phone: '' });
    setEditingFriend(null);
  };

  const renderFriendItem = ({ item }) => (
    <View style={styles.friendCard}>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendEmail}>{item.email}</Text>
        <Text style={styles.friendPhone}>{item.phone}</Text>
      </View>
      <View style={styles.friendActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => deleteFriend(item)}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Friends</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Text style={styles.addButtonText}>+ Add Friend</Text>
        </TouchableOpacity>
      </View>

      {/* Friends List */}
      <FlatList
        data={friends}
        renderItem={renderFriendItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={loadFriends}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No friends yet</Text>
            <Text style={styles.emptySubtext}>Tap "Add Friend" to get started</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingFriend ? 'Edit Friend' : 'Add Friend'}
            </Text>
            <TouchableOpacity onPress={saveFriend}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={friendForm.name}
              onChangeText={(text) =>
                setFriendForm({ ...friendForm, name: text })
              }
              placeholder="Enter friend's name"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={friendForm.email}
              onChangeText={(text) =>
                setFriendForm({ ...friendForm, email: text })
              }
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={friendForm.phone}
              onChangeText={(text) =>
                setFriendForm({ ...friendForm, phone: text })
              }
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  friendCard: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  friendEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  friendPhone: {
    fontSize: 14,
    color: '#666',
  },
  friendActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    color: '#007AFF',
  },
  saveButton: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});