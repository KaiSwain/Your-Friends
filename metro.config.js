// Metro config — extends Expo's defaults and adds react-native-svg-transformer
// so `.svg` files can be imported directly as React components:
//     import Star from '../assets/icons/star.svg';
//     <Star width={24} height={24} fill={colors.accent} />
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const { resolver, transformer } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

module.exports = config;
