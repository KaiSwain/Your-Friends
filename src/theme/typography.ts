// Export a map of semantic font roles so components can ask for a role instead of a raw font name.
export const fonts = {
  // Use the Newsreader semi-bold face for display headings and other prominent titles.
  heading: 'Newsreader_600SemiBold',
  // Use the regular Manrope face for standard paragraph and body text.
  body: 'Manrope_400Regular',
  // Use the medium Manrope face when body text needs a little more emphasis.
  bodyMedium: 'Manrope_500Medium',
  // Use the bold Manrope face for strong labels, buttons, and highlights.
  bodyBold: 'Manrope_700Bold',
}; // End the shared font role mapping.