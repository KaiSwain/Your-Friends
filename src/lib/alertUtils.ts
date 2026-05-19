import { Alert } from 'react-native';

export function showErrorAlert(title: string, message: string) {
  Alert.alert(title, message, [{ text: 'OK' }]);
}

export function showDestructiveConfirmAlert({
  cancelText = 'Cancel',
  confirmText,
  message,
  onConfirm,
  title,
}: {
  cancelText?: string;
  confirmText: string;
  message: string;
  onConfirm: () => void;
  title: string;
}) {
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}
