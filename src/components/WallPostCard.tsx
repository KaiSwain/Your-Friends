import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { contrastText, contrastTextSoft, contrastAccent } from '../lib/contrastText';
import { getFilterByKey } from '../lib/polaroidFilters';
import { getCureProgress, getCureStyles, CURE_DURATION_MS } from '../lib/polaroidCure';
import { sharePolaroid } from '../lib/sharePolaroid';
import { resolveWallPostTextColor, resolveWallPostTextStyle } from '../lib/wallPostTextStyle';
import { MemoryStyledText } from './MemoryStyledText';
import { WallPost } from '../types/domain';
import type { FontSet } from '../theme/typography';
import { spacing } from '../theme/tokens';

const CURE_REFRESH_MS = 250;

interface WallPostCardProps {
  authorName: string;
  post: WallPost;
  cardColor?: string | null;
  themeColors?: ColorTokens;
  editing?: boolean;
  preview?: boolean;
  shareable?: boolean;
  onPress?: () => void;
  onFlip?: (showingBack: boolean) => void;
  onSaveBackText?: (postId: string, text: string) => void;
}

export function WallPostCard({ authorName, post, cardColor, themeColors, editing: editMode, preview, shareable, onPress, onFlip, onSaveBackText }: WallPostCardProps) {
  const { colors: appColors, fonts } = useTheme();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [frontHeight, setFrontHeight] = useState(0);

  // ── Capture ref for sharing ──────────────────────────────────────────
  const captureRef = useRef<View>(null);
  const handleShare = useCallback(() => { sharePolaroid(captureRef); }, []);

  // ── Polaroid curing ──────────────────────────────────────────────────
  const [now, setNow] = useState(Date.now());
  const cureProgress = preview ? 1 : getCureProgress(post.createdAt, now);
  const cure = getCureStyles(cureProgress);

  useEffect(() => {
    if (!cure.developing || preview) return;
    const id = setInterval(() => setNow(Date.now()), CURE_REFRESH_MS);
    return () => clearInterval(id);
  }, [cure.developing, preview]);

  // Flip: showBack tracks which face is visible, animValue drives rotation
  const [showBack, setShowBack] = useState(false);
  const [editingBack, setEditingBack] = useState(false);
  const [backDraft, setBackDraft] = useState(post.backText ?? '');
  const animating = useRef(false);
  const animValue = useRef(new Animated.Value(0)).current;

  const canEditBack = !!editMode && !!onSaveBackText;

  const rotateY = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '0deg'],
  });
  const scaleX = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.95, 1],
  });

  const handleFlip = useCallback(() => {
    if (animating.current) return;
    // Edit mode: no flipping
    if (editMode) return;
    // If currently on back and editing, save first
    if (showBack && editingBack) {
      if (onSaveBackText && backDraft !== (post.backText ?? '')) {
        onSaveBackText(post.id, backDraft);
      }
      setEditingBack(false);
    }
    animating.current = true;
    // Animate to midpoint (card edge-on)
    Animated.timing(animValue, {
      toValue: 0.5,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      // Swap content at midpoint.
      const nextShowBack = !showBack;
      setShowBack(nextShowBack);
      onFlip?.(nextShowBack);
      // Animate from midpoint back to flat
      Animated.timing(animValue, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        animValue.setValue(0);
        animating.current = false;
      });
    });
  }, [showBack, editingBack, editMode, backDraft, post.backText, post.id, onSaveBackText, onFlip, animValue]);

  // Stable random tilt per card instance.
  const tilt = useRef((Math.random() - 0.5) * 5).current;
  // Micro photo tilt — slightly different from card tilt for realism.
  const photoTilt = useRef((Math.random() - 0.5) * 0.8).current;

  useEffect(() => {
    if (post.imageUri) {
      Image.getSize(
        post.imageUri,
        (w, h) => { if (h > 0) setAspectRatio(w / h); },
        () => setAspectRatio(null),
      );
    }
  }, [post.imageUri]);

  const onFrameLayout = (e: LayoutChangeEvent) => {
    setFrameWidth(e.nativeEvent.layout.width);
  };

  const date = new Date(post.createdAt);
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Classic film-camera date stamp: YY.MM.DD HH:MM
  const stampText = post.dateStamp
    ? `${String(date.getFullYear()).slice(-2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : null;

  const imageHeight = aspectRatio && frameWidth > 0
    ? frameWidth / aspectRatio
    : 260;

  const bg = cardColor || POLAROID_FRAME;
  // On the default ivory frame, always use dark ink (readable in any theme mode).
  // On custom card colors, use computed contrast colors.
  const frameDefault = !cardColor;
  const ct = frameDefault ? FRAME_INK : contrastText(cardColor);
  const ctSoft = frameDefault ? FRAME_INK_SOFT : contrastTextSoft(cardColor);
  const ctAccent = frameDefault ? colors.accent : contrastAccent(cardColor, colors.accent);

  const isTextOnly = !post.imageUri;
  const textOnlyTypography = useMemo(
    () => resolveWallPostTextStyle(fonts, post.textFont, post.textSize),
    [fonts, post.textFont, post.textSize],
  );
  const textOnlyColor = useMemo(() => resolveWallPostTextColor(post.textColor, colors), [colors, post.textColor]);
  const showDevelopingStatus = cure.developing && (editMode || !showBack);

  if (isTextOnly) {
    return (
      <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.wrapper, pressed && onPress && styles.pressed]}>
        <View style={[styles.textOnlyCard, { transform: [{ rotate: `${tilt}deg` }] }]}>
          {post.body ? (
            <MemoryStyledText
              text={post.body}
              effect={post.textEffect}
              color={textOnlyColor}
              accentColor={textOnlyColor}
              paperColor={colors.paper}
              style={[styles.textOnlyBody, textOnlyTypography]}
            />
          ) : null}
          <Text style={styles.textOnlyDate}>{formatted}</Text>
        </View>
      </Pressable>
    );
  }

  /* ── Single animated view — content swaps at the 90° midpoint ── */
  const onFrontLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setFrontHeight(h);
  };

  return (
    <View style={[styles.wrapper, showBack && !editMode && { zIndex: 10 }]}>
      <Animated.View style={{ transform: [{ perspective: 800 }, { rotateY }, { scaleX }] }} renderToHardwareTextureAndroid shouldRasterizeIOS>
        {editMode ? (
          <Pressable onPress={onPress}>
            {/* Front of the polaroid — edit mode (no flip animation) */}
            <View style={styles.cardWithStatus}>
              <View onLayout={onFrontLayout} style={styles.ambientShadow}>
                <View style={styles.tape} />
                <View style={[styles.card, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }]}>
                  <View style={[styles.photoFrame, { transform: [{ rotate: `${photoTilt}deg` }] }]} onLayout={onFrameLayout}>
                    <Image source={{ uri: post.imageUri! }} style={[styles.image, { height: imageHeight }]} fadeDuration={0} blurRadius={cure.imageBlur} />
                    <View style={styles.warmBaseTint} />
                    {cure.developing && (
                      <>
                        <View style={[styles.darkOverlay, { opacity: cure.darkOverlay }]} />
                        {cure.warmOverlay > 0 && <View style={[styles.warmOverlay, { opacity: cure.warmOverlay }]} />}
                      </>
                    )}
                    {post.filter && (() => {
                      const f = getFilterByKey(post.filter);
                      if (!f) return null;
                      return (
                        <>
                          {f.overlay && <View style={[styles.filterOverlay, { backgroundColor: f.overlay }]} />}
                          {f.overlay2 && <View style={[styles.filterOverlay, { backgroundColor: f.overlay2 }]} />}
                        </>
                      );
                    })()}
                    <LinearGradient
                      colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.06)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.photoSheen}
                    />
                    <View style={styles.insetShadowTop} />
                    <View style={styles.insetShadowLeft} />
                    {stampText && <Text style={[styles.dateStamp, cure.developing && { opacity: 1 - cure.darkOverlay }]}>{stampText}</Text>}
                  </View>
                  <View style={styles.bottomStrip}>
                    <Text style={[styles.date, { color: ctAccent }]}>{formatted}</Text>
                    <View style={styles.textSlot}>
                      {post.body ? <Text style={[styles.text, { color: ct }]} numberOfLines={FRONT_TEXT_LINES}>{post.body}</Text> : null}
                    </View>
                    <Text style={[styles.author, { color: ctSoft }]}>— {authorName}</Text>
                  </View>
                </View>
              </View>
              {showDevelopingStatus && <Text style={styles.developingLabel}>Developing…</Text>}
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={handleFlip}>
            <View style={styles.cardWithStatus}>
              <View ref={captureRef} collapsable={false} style={shareable ? styles.captureStage : undefined}>
                <View onLayout={onFrontLayout} style={styles.flipCardHost}>
                  <View pointerEvents={showBack ? 'none' : 'auto'} style={[styles.flipFace, showBack && styles.hiddenFace]}>
                    <View style={styles.ambientShadow}>
                      <View style={styles.tape} />
                      <View style={[styles.card, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }]}> 
                        <View style={[styles.photoFrame, { transform: [{ rotate: `${photoTilt}deg` }] }]} onLayout={onFrameLayout}>
                          <Image source={{ uri: post.imageUri! }} style={[styles.image, { height: imageHeight }]} fadeDuration={0} blurRadius={cure.imageBlur} />
                          {/* Permanent subtle warm base — Polaroid chemistry tint */}
                          <View style={styles.warmBaseTint} />
                          {cure.developing && (
                            <>
                              <View style={[styles.darkOverlay, { opacity: cure.darkOverlay }]} />
                              {cure.warmOverlay > 0 && <View style={[styles.warmOverlay, { opacity: cure.warmOverlay }]} />}
                            </>
                          )}
                          {post.filter && (() => {
                            const f = getFilterByKey(post.filter);
                            if (!f) return null;
                            return (
                              <>
                                {f.overlay && <View style={[styles.filterOverlay, { backgroundColor: f.overlay }]} />}
                                {f.overlay2 && <View style={[styles.filterOverlay, { backgroundColor: f.overlay2 }]} />}
                              </>
                            );
                          })()}
                          {/* Glossy sheen — diagonal light reflection */}
                          <LinearGradient
                            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.06)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.photoSheen}
                          />
                          {/* Inset shadow — pressed-in photo area */}
                          <View style={styles.insetShadowTop} />
                          <View style={styles.insetShadowLeft} />
                          {stampText && <Text style={[styles.dateStamp, cure.developing && { opacity: 1 - cure.darkOverlay }]}>{stampText}</Text>}
                        </View>
                        <View style={styles.bottomStrip}>
                          <Text style={[styles.date, { color: ctAccent }]}>{formatted}</Text>
                          <View style={styles.textSlot}>
                            {post.body ? <Text style={[styles.text, { color: ct }]} numberOfLines={FRONT_TEXT_LINES}>{post.body}</Text> : null}
                          </View>
                          <Text style={[styles.author, { color: ctSoft }]}>— {authorName}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
 
                  <View pointerEvents={showBack ? 'auto' : 'none'} style={[styles.flipFaceOverlay, !showBack && styles.hiddenFace]}>
                    <View style={styles.ambientShadow}>
                      <View style={styles.tape} />
                      <View style={[styles.card, styles.backCard, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }, frontHeight > 0 && { height: frontHeight }]}> 
                        {editingBack ? (
                          <TextInput
                            style={[styles.backText, { color: ct }]}
                            value={backDraft}
                            onChangeText={setBackDraft}
                            placeholder="Write something…"
                            placeholderTextColor={FRAME_INK_MUTED}
                            multiline
                            autoFocus
                          />
                        ) : (
                          <Pressable onPress={() => { if (canEditBack) setEditingBack(true); }} disabled={!canEditBack}>
                            <Text style={[styles.backText, { color: ct }]}> 
                              {post.backText || (canEditBack ? 'Tap to write…' : '')}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
              {showDevelopingStatus && <Text style={styles.developingLabel}>Developing…</Text>}
            </View>
          </Pressable>
        )}
        {shareable && !editingBack && (
          <Pressable onPress={handleShare} style={styles.shareButton} accessibilityRole="button" accessibilityLabel={showBack ? 'Share polaroid back' : 'Share polaroid'}>
            <Ionicons name="share-outline" size={18} color={colors.inkSoft} />
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const CARD_PADDING_SIDE = 14;
const CARD_PADDING_TOP = 12;
const CARD_PADDING_BOTTOM = 38;
const FRONT_TEXT_LINE_HEIGHT = 22;
const FRONT_TEXT_LINES = 2;
const FRONT_TEXT_SLOT_HEIGHT = FRONT_TEXT_LINE_HEIGHT * FRONT_TEXT_LINES;
const FRONT_BOTTOM_MIN_HEIGHT = 120;

// Warm ivory — real Polaroid frames are never pure white.
const POLAROID_FRAME = '#F5F2EA';

// Dark ink colors for text on Polaroid frame (always light ivory regardless of theme)
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';
const FRAME_INK_MUTED = '#9A9080';

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    wrapper: { paddingVertical: spacing.sm, alignItems: 'center' },
    pressed: { transform: [{ scale: 0.985 }] },
    captureStage: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardWithStatus: {
      alignItems: 'center',
    },
    flipCardHost: {
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    flipFace: {
      alignItems: 'center',
    },
    flipFaceOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    hiddenFace: {
      opacity: 0,
    },

    /* ── Share button ── */
    shareButton: {
      alignSelf: 'center' as const,
      marginTop: spacing.xs,
      padding: spacing.xs,
      borderRadius: 16,
    },

    /* ── Text-only (plain, no card) ── */
    textOnlyCard: {
      alignItems: 'center' as const,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    textOnlyBody: {
      textAlign: 'center' as const,
    },
    textOnlyDate: {
      fontFamily: fonts.handwritten,
      fontSize: 13,
      color: colors.accent,
    },

    /* ── Polaroid card ── */
    tape: {
      width: 48,
      height: 14,
      backgroundColor: 'rgba(255,255,220,0.35)',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: -7,
      zIndex: 1,
    },
    card: {
      width: 260,
      borderRadius: 3,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(180,170,155,0.4)',
      paddingTop: CARD_PADDING_TOP,
      paddingHorizontal: CARD_PADDING_SIDE,
      paddingBottom: 0,
      // Contact shadow (tight, dark)
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 5,
    },
    photoFrame: {
      borderRadius: 1,
      overflow: 'hidden',
      // Subtle border to define the photo inset
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.045)',
    },
    photoPlaceholderArea: {
      height: 200,
      backgroundColor: colors.canvasAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: { width: '100%', transform: [{ scale: 1.01 }] },
    photoPlaceholder: { fontSize: 36 },
    dateStamp: {
      position: 'absolute' as const,
      bottom: 8,
      right: 8,
      fontFamily: 'Courier',
      fontWeight: '700' as const,
      fontSize: 12,
      color: colors.accent,
      textShadowColor: 'rgba(0,0,0,0.7)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      zIndex: 10,
      pointerEvents: 'none' as const,
    },
    bottomStrip: {
      paddingTop: spacing.sm,
      paddingBottom: CARD_PADDING_BOTTOM - CARD_PADDING_TOP,
      gap: spacing.xs,
      minHeight: FRONT_BOTTOM_MIN_HEIGHT,
      justifyContent: 'flex-start',
    },
    textSlot: {
      minHeight: FRONT_TEXT_SLOT_HEIGHT,
      justifyContent: 'flex-start',
    },
    date: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 14,
      color: colors.accent,
      letterSpacing: 0.3,
    },
    text: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      lineHeight: FRONT_TEXT_LINE_HEIGHT,
      color: colors.ink,
    },
    author: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      color: colors.inkSoft,
    },

    /* ── Back face ── */
    backCard: {
      paddingBottom: CARD_PADDING_SIDE,
    },
    backContent: {
      flex: 1,
    },
    backLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: spacing.sm,
    },
    backText: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      lineHeight: 24,
      color: FRAME_INK,
      flex: 1,
      minHeight: 120,
      padding: 0,
    },
    backFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(128,128,128,0.2)',
      paddingTop: spacing.sm,
      gap: 2,
      marginTop: spacing.md,
    },
    flipHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.inkMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },

    /* ── Polaroid curing ── */
    darkOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
      zIndex: 1,
      pointerEvents: 'none',
    },
    warmOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#D4A76A',
      zIndex: 2,
      pointerEvents: 'none',
    },
    developingLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.inkMuted,
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: spacing.xs,
    },
    filterOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 3,
      pointerEvents: 'none' as const,
    },

    /* ── Photo realism overlays ── */
    warmBaseTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(210,180,140,0.04)',
      zIndex: 4,
      pointerEvents: 'none' as const,
    },
    photoSheen: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
      pointerEvents: 'none' as const,
    },
    insetShadowTop: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: 6,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      // Simulate inset shadow with a gradient-like dark strip
      opacity: 1,
      zIndex: 6,
      pointerEvents: 'none' as const,
      borderBottomWidth: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    insetShadowLeft: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      bottom: 0,
      width: 4,
      backgroundColor: 'transparent',
      zIndex: 6,
      pointerEvents: 'none' as const,
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    /* ── Ambient shadow wrapper ── */
    ambientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
  });
