import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View, type StyleProp, type TextStyle } from 'react-native';

import { usePremium } from '../features/premium/PremiumContext';
import { useTheme } from '../features/theme/ThemeContext';
import { showVoiceMemoryPaywall } from '../lib/premiumGates';
import { pushOnce } from '../lib/navigationGuard';
import { radius, spacing } from '../theme/tokens';
import type { VoiceAttachment } from '../types/domain';
import { DEFAULT_VOICE_RECORDING_MAX_MS, VoiceRecorder } from './VoiceRecorder';

type ComposerMode = 'text' | 'voice';

interface TextOrVoiceComposerProps {
  label?: string;
  text: string;
  onTextChange: (text: string) => void;
  voice: VoiceAttachment | null;
  onVoiceChange: (voice: VoiceAttachment | null) => void;
  placeholder?: string;
  helperText?: string;
  voiceLabel?: string;
  voiceHelperText?: string;
  previewAuthorName?: string;
  disabled?: boolean;
  allowVoice?: boolean;
  maxVoiceMs?: number;
  textInputStyle?: StyleProp<TextStyle>;
  textInputProps?: Omit<TextInputProps, 'multiline' | 'onChangeText' | 'placeholder' | 'placeholderTextColor' | 'style' | 'value'>;
  onModeChange?: (mode: ComposerMode) => void;
}

export function TextOrVoiceComposer({
  label,
  text,
  onTextChange,
  voice,
  onVoiceChange,
  placeholder = 'Write something...',
  helperText,
  voiceLabel = 'Voice note',
  voiceHelperText = 'Record instead of typing.',
  previewAuthorName,
  disabled,
  allowVoice = true,
  maxVoiceMs = DEFAULT_VOICE_RECORDING_MAX_MS,
  textInputStyle,
  textInputProps,
  onModeChange,
}: TextOrVoiceComposerProps) {
  const router = useRouter();
  const { isPremium } = usePremium();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [mode, setMode] = useState<ComposerMode>(() => (allowVoice && voice ? 'voice' : 'text'));

  const visibleMode = allowVoice ? mode : 'text';

  useEffect(() => {
    onModeChange?.(visibleMode);
  }, [onModeChange, visibleMode]);

  function selectMode(nextMode: ComposerMode) {
    if (disabled) return;
    if (nextMode === 'voice' && !isPremium) {
      showVoiceMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    setMode(nextMode);
    if (nextMode === 'voice' && text) onTextChange('');
    if (nextMode === 'text' && voice) onVoiceChange(null);
  }

  return (
    <View style={styles.container}>
      {label || helperText ? (
        <View style={styles.header}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
        </View>
      ) : null}
      {allowVoice ? (
        <View style={styles.modeSelector}>
          <Pressable
            onPress={() => selectMode('text')}
            style={[styles.modeOption, visibleMode === 'text' && styles.modeOptionActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: visibleMode === 'text' }}
          >
            <Ionicons name="text-outline" size={15} color={visibleMode === 'text' ? colors.white : colors.ink} />
            <Text style={[styles.modeOptionText, visibleMode === 'text' && styles.modeOptionTextActive]}>Text</Text>
          </Pressable>
          <Pressable
            onPress={() => selectMode('voice')}
            style={[styles.modeOption, visibleMode === 'voice' && styles.modeOptionActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: visibleMode === 'voice', disabled: disabled }}
          >
            <Ionicons name={isPremium ? 'mic-outline' : 'lock-closed-outline'} size={15} color={visibleMode === 'voice' ? colors.white : colors.ink} />
            <Text style={[styles.modeOptionText, visibleMode === 'voice' && styles.modeOptionTextActive]}>Voice</Text>
          </Pressable>
        </View>
      ) : null}
      {visibleMode === 'text' ? (
        <TextInput
          multiline
          value={text}
          onChangeText={onTextChange}
          placeholder={placeholder}
          placeholderTextColor={colors.ink}
          style={[styles.textInput, textInputStyle]}
          editable={!disabled}
          {...textInputProps}
        />
      ) : isPremium ? (
        <VoiceRecorder
          value={voice}
          onChange={onVoiceChange}
          disabled={disabled}
          maxDurationMs={maxVoiceMs}
          label={voiceLabel}
          helperText={voiceHelperText}
          previewAuthorName={previewAuthorName}
        />
      ) : (
        <Pressable
          onPress={() => showVoiceMemoryPaywall(() => pushOnce(router, '/(app)/store'))}
          style={styles.lockedVoice}
          accessibilityRole="button"
        >
          <Ionicons name="lock-closed-outline" size={15} color={colors.accent} />
          <Text style={styles.lockedVoiceText}>Unlock Premium to add voice.</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    gap: 3,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMuted,
  },
  modeSelector: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: 4,
    gap: 4,
  },
  modeOption: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  modeOptionActive: {
    backgroundColor: colors.accent,
  },
  modeOptionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  modeOptionTextActive: {
    color: colors.white,
  },
  textInput: {
    minHeight: 110,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
    textAlignVertical: 'top',
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  lockedVoice: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lockedVoiceText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
});
