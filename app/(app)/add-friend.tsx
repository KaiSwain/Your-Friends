import { Redirect, useLocalSearchParams } from 'expo-router';

import { extractFriendCode } from '../../src/lib/friendCode';

// Universal Links / invite links arrive as `/add-friend?code=XXXX`. expo-router
// resolves the incoming URL against the file routes, so this screen exists purely
// to catch that path and forward it to the real add-friend screen with the code
// prefilled (otherwise the router shows a "page not found" screen).
export default function AddFriendInviteRedirect() {
  const params = useLocalSearchParams<{ code?: string }>();
  const rawCode = typeof params.code === 'string' ? params.code : '';
  const code = extractFriendCode(rawCode);

  return (
    <Redirect href={code ? { pathname: '/(app)/friends/add', params: { code } } : '/(app)/friends/add'} />
  );
}
