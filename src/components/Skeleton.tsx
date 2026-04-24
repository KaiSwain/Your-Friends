import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#333',
          opacity,
        },
        style,
      ]}
    />
  );
}

/** A skeleton that mimics a person card in the carousel. */
export function CarouselCardSkeleton() {
  return (
    <View style={cardStyles.card}>
      <Skeleton width="100%" height={160} borderRadius={12} />
      <View style={cardStyles.row}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={cardStyles.text}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
        </View>
      </View>
    </View>
  );
}

/** A skeleton that mimics a list row (notification, section item). */
export function ListRowSkeleton() {
  return (
    <View style={rowStyles.row}>
      <Skeleton width={36} height={36} borderRadius={18} />
      <View style={rowStyles.text}>
        <Skeleton width="75%" height={12} />
        <Skeleton width="50%" height={10} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

/** A skeleton for a full profile screen (hero + facts + posts). */
export function ProfileSkeleton() {
  return (
    <View style={profileStyles.container}>
      <Skeleton width="100%" height={200} borderRadius={16} />
      <View style={profileStyles.facts}>
        <Skeleton width="80%" height={12} />
        <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
        <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
      </View>
      <Skeleton width="100%" height={140} borderRadius={12} style={{ marginTop: 20 }} />
      <Skeleton width="100%" height={140} borderRadius={12} style={{ marginTop: 12 }} />
    </View>
  );
}

/** Skeleton mimicking the friends list home screen (carousel + sections). */
export function FriendsListSkeleton() {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <CarouselCardSkeleton />
        <CarouselCardSkeleton />
      </View>
      <ListRowSkeleton />
      <ListRowSkeleton />
      <ListRowSkeleton />
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { width: 150, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1 },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  text: { flex: 1 },
});

const profileStyles = StyleSheet.create({
  container: { padding: 16 },
  facts: { marginTop: 16, gap: 0 },
});
