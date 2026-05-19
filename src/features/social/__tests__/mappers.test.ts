import { describe, expect, it } from '@jest/globals';

import {
  rowToUser,
  rowToContact,
  rowToFriendship,
  rowToWallPost,
  rowToFriendFact,
  rowToMemoryReply,
  rowToNotification,
  rowToCalendarEventReaction,
} from '../mappers';

describe('rowToUser', () => {
  it('maps snake_case DB row to camelCase AppUser', () => {
    const row = {
      id: 'u1',
      email: 'a@b.com',
      display_name: 'Alice',
      friend_code: 'ABCD1234',
      avatar_color: '#FF0000',
      avatar_path: 'https://img.test/a.jpg',
      birthday: '1998-04-12',
      profile_bg_image_path: 'https://img.test/bg.jpg',
      profile_bg_image_public: true,
      profile_facts: ['Loves cats'],
      premium_until: '2026-05-14T12:00:00Z',
      premium_paid_until: '2026-05-14T12:00:00Z',
      premium_free_until: '2026-05-10T12:00:00Z',
      premium_free_granted_by_user_id: 'grantor-1',
      premium_free_granted_at: '2026-05-07T12:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
    };
    const user = rowToUser(row);
    expect(user).toEqual({
      id: 'u1',
      email: 'a@b.com',
      displayName: 'Alice',
      friendCode: 'ABCD1234',
      avatarColor: '#FF0000',
      avatarPath: 'https://img.test/a.jpg',
      birthday: '1998-04-12',
      profileBgImagePath: 'https://img.test/bg.jpg',
      profileBgImagePublic: true,
      profileFacts: ['Loves cats'],
      premiumUntil: '2026-05-14T12:00:00Z',
      premiumPaidUntil: '2026-05-14T12:00:00Z',
      premiumFreeUntil: '2026-05-10T12:00:00Z',
      premiumFreeGrantorUserId: 'grantor-1',
      premiumFreeGrantedAt: '2026-05-07T12:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
    });
  });

  it('defaults nullable fields', () => {
    const user = rowToUser({ id: 'u2', email: '', display_name: '', friend_code: '', avatar_color: '', created_at: '' });
    expect(user.avatarPath).toBeNull();
    expect(user.birthday).toBeNull();
    expect(user.profileBgImagePath).toBeNull();
    expect(user.profileBgImagePublic).toBe(false);
    expect(user.profileFacts).toEqual([]);
    expect(user.premiumUntil).toBeNull();
    expect(user.premiumPaidUntil).toBeNull();
    expect(user.premiumFreeUntil).toBeNull();
    expect(user.premiumFreeGrantorUserId).toBeNull();
    expect(user.premiumFreeGrantedAt).toBeNull();
  });
});

describe('rowToContact', () => {
  it('maps all fields correctly', () => {
    const row = {
      id: 'c1',
      owner_user_id: 'u1',
      linked_user_id: 'u2',
      display_name: 'Bob',
      nickname: 'Bobby',
      facts: ['Fact 1'],
      avatar_path: null,
      avatar_video_path: 'https://video.test/hero.mp4',
      avatar_video_muted: true,
      tags: ['family'],
      note: 'Note here',
      card_color: '#00FF00',
      profile_bg: 'ocean',
      pinned: true,
      pinned_at: '2024-02-02T00:00:00Z',
      created_at: '2024-02-01T00:00:00Z',
    };
    const contact = rowToContact(row);
    expect(contact.ownerUserId).toBe('u1');
    expect(contact.linkedUserId).toBe('u2');
    expect(contact.nickname).toBe('Bobby');
    expect(contact.tags).toEqual(['family']);
    expect(contact.avatarVideoPath).toBe('https://video.test/hero.mp4');
    expect(contact.avatarVideoMuted).toBe(true);
    expect(contact.pinned).toBe(true);
    expect(contact.pinnedAt).toBe('2024-02-02T00:00:00Z');
    expect(contact.profileBg).toBe('ocean');
  });

  it('defaults missing nullable fields', () => {
    const contact = rowToContact({ id: 'c2', owner_user_id: 'u1', display_name: 'Test', created_at: '' });
    expect(contact.linkedUserId).toBeNull();
    expect(contact.nickname).toBeNull();
    expect(contact.facts).toEqual([]);
    expect(contact.tags).toEqual([]);
    expect(contact.avatarVideoPath).toBeNull();
    expect(contact.avatarVideoMuted).toBe(false);
    expect(contact.note).toBeNull();
    expect(contact.cardColor).toBeNull();
    expect(contact.profileBg).toBeNull();
    expect(contact.pinned).toBe(false);
    expect(contact.pinnedAt).toBeNull();
  });
});

describe('rowToFriendship', () => {
  it('maps canonical pair fields', () => {
    const fs = rowToFriendship({
      id: 'f1',
      user_low_id: 'aaa',
      user_high_id: 'zzz',
      created_by_user_id: 'aaa',
      created_at: '2024-03-01',
    });
    expect(fs.userLowId).toBe('aaa');
    expect(fs.userHighId).toBe('zzz');
    expect(fs.createdByUserId).toBe('aaa');
  });
});

describe('rowToMemoryReply', () => {
  it('maps memory reply rows', () => {
    expect(rowToMemoryReply({
      id: 'reply-1',
      wall_post_id: 'post-1',
      author_user_id: 'user-1',
      body: 'I remember this.',
      created_at: '2026-05-19T12:00:00Z',
      updated_at: '2026-05-19T12:01:00Z',
    })).toEqual({
      id: 'reply-1',
      wallPostId: 'post-1',
      authorUserId: 'user-1',
      body: 'I remember this.',
      createdAt: '2026-05-19T12:00:00Z',
      updatedAt: '2026-05-19T12:01:00Z',
    });
  });
});

describe('rowToWallPost', () => {
  it('maps location_name to locationName', () => {
    const post = rowToWallPost({
      id: 'p-location',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      visibility: 'private',
      body: 'At the lake',
      location_name: 'Echo Park Lake',
      created_at: '2024-04-01',
    });
    expect(post.locationName).toBe('Echo Park Lake');
  });

  it('maps image_path to imageUri', () => {
    const post = rowToWallPost({
      id: 'p1',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      visibility: 'private',
      body: 'Hello',
      image_path: 'https://img.test/x.jpg',
      video_path: 'https://video.test/live.mp4',
      video_muted: true,
      memory_date: '2024-03-28',
      card_color: '#FFF',
      back_text: 'Back',
      created_at: '2024-04-01',
    });
    expect(post.imageUri).toBe('https://img.test/x.jpg');
    expect(post.videoUri).toBe('https://video.test/live.mp4');
    expect(post.videoMuted).toBe(true);
    expect(post.memoryDate).toBe('2024-03-28');
    expect(post.locationName).toBeNull();
    expect(post.postType).toBe('polaroid');
    expect(post.backText).toBe('Back');
    expect(post.subjectContactId).toBeNull();
    expect(post.song).toBeNull();
  });

  it('decodes text-only style metadata stored in filter', () => {
    const post = rowToWallPost({
      id: 'p2',
      author_user_id: 'u1',
      subject_contact_id: 'c1',
      visibility: 'private',
      body: 'Styled note',
      filter: '__yf_text_style__:{"font":"marker","size":34,"effect":"glow","color":"rose"}',
      created_at: '2024-04-02',
    });
    expect(post.filter).toBeNull();
    expect(post.textFont).toBe('marker');
    expect(post.textSize).toBe(34);
    expect(post.textEffect).toBe('glow');
    expect(post.textColor).toBe('rose');
  });

  it('maps song metadata to a song memory', () => {
    const post = rowToWallPost({
      id: 'p3',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      visibility: 'visible_to_subject',
      post_type: 'song',
      body: 'This one is us.',
      song_provider: 'apple',
      song_provider_id: '12345',
      song_title: 'Golden Hour',
      song_artist: 'Friend Band',
      song_artwork_url: 'https://img.test/art.jpg',
      song_preview_url: 'https://audio.test/preview.m4a',
      song_external_url: 'https://music.test/song',
      created_at: '2024-04-03',
    });
    expect(post.postType).toBe('song');
    expect(post.song).toEqual({
      provider: 'apple',
      providerTrackId: '12345',
      title: 'Golden Hour',
      artist: 'Friend Band',
      artworkUrl: 'https://img.test/art.jpg',
      previewUrl: 'https://audio.test/preview.m4a',
      externalUrl: 'https://music.test/song',
    });
  });

  it('keeps song metadata attached to image posts', () => {
    const post = rowToWallPost({
      id: 'p5',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      visibility: 'visible_to_subject',
      body: 'This photo has a soundtrack.',
      image_path: 'https://img.test/photo.jpg',
      song_provider: 'apple',
      song_provider_id: '67890',
      song_title: 'Snapshot Song',
      song_artist: 'Camera Crew',
      song_artwork_url: null,
      song_preview_url: 'https://audio.test/snapshot.m4a',
      song_external_url: null,
      created_at: '2024-04-05',
    });
    expect(post.postType).toBe('polaroid');
    expect(post.imageUri).toBe('https://img.test/photo.jpg');
    expect(post.song).toEqual({
      provider: 'apple',
      providerTrackId: '67890',
      title: 'Snapshot Song',
      artist: 'Camera Crew',
      artworkUrl: null,
      previewUrl: 'https://audio.test/snapshot.m4a',
      externalUrl: null,
    });
  });

  it('keeps song metadata attached to explicit note posts', () => {
    const post = rowToWallPost({
      id: 'p6',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      visibility: 'visible_to_subject',
      post_type: 'note',
      body: 'This note has a soundtrack.',
      song_provider: 'apple',
      song_provider_id: '24680',
      song_title: 'Notebook Song',
      song_artist: 'Paper Trail',
      song_artwork_url: null,
      song_preview_url: 'https://audio.test/notebook.m4a',
      song_external_url: null,
      created_at: '2024-04-06',
    });
    expect(post.postType).toBe('note');
    expect(post.imageUri).toBeNull();
    expect(post.song).toEqual({
      provider: 'apple',
      providerTrackId: '24680',
      title: 'Notebook Song',
      artist: 'Paper Trail',
      artworkUrl: null,
      previewUrl: 'https://audio.test/notebook.m4a',
      externalUrl: null,
    });
  });

  it('maps generic memory prompt metadata', () => {
    const post = rowToWallPost({
      id: 'p7',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      visibility: 'visible_to_subject',
      post_type: 'note',
      body: 'This one.',
      memory_prompt_request_id: 'prompt-1',
      referenced_wall_post_id: 'p1',
      prompt_text: 'Pick a polaroid that reminds you of us.',
      prompt_type: 'photo_reference',
      created_at: '2024-04-07',
    });
    expect(post.memoryPromptRequestId).toBe('prompt-1');
    expect(post.referencedWallPostId).toBe('p1');
    expect(post.promptText).toBe('Pick a polaroid that reminds you of us.');
    expect(post.promptType).toBe('photo_reference');
  });

  it('falls back from song type when song metadata is incomplete', () => {
    const post = rowToWallPost({
      id: 'p4',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      visibility: 'visible_to_subject',
      post_type: 'song',
      body: 'Missing track details',
      created_at: '2024-04-04',
    });
    expect(post.postType).toBe('note');
    expect(post.song).toBeNull();
  });

  it('maps movie metadata to a movie memory', () => {
    const post = rowToWallPost({
      id: 'p7',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      visibility: 'visible_to_subject',
      post_type: 'movie',
      body: 'Five stars, no notes.',
      movie_tmdb_id: '550',
      movie_title: 'Fight Club',
      movie_year: '1999',
      movie_poster_url: 'https://image.test/poster.jpg',
      movie_overview: 'A movie overview.',
      movie_release_date: '1999-10-15',
      movie_vote_average: 8.4,
      movie_review_rating: 5,
      movie_review_request_id: 'request-1',
      created_at: '2024-04-07',
    });
    expect(post.postType).toBe('movie');
    expect(post.movie).toEqual({
      tmdbId: '550',
      title: 'Fight Club',
      year: '1999',
      posterUrl: 'https://image.test/poster.jpg',
      overview: 'A movie overview.',
      releaseDate: '1999-10-15',
      voteAverage: 8.4,
      reviewRating: 5,
      reviewRequestId: 'request-1',
    });
  });
});

describe('rowToFriendFact', () => {
  it('maps all fields', () => {
    const fact = rowToFriendFact({
      id: 'ff1',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      body: 'Likes pizza',
      created_at: '2024-05-01',
    });
    expect(fact.authorUserId).toBe('u1');
    expect(fact.body).toBe('Likes pizza');
  });
});

describe('rowToNotification', () => {
  it('maps all fields and defaults referenceId', () => {
    const n = rowToNotification({
      id: 'n1',
      recipient_user_id: 'u1',
      actor_user_id: 'u2',
      type: 'wall_post',
      metadata: { eventId: 'event-1', date: '2026-05-14' },
      message: 'New post',
      read: false,
      created_at: '2024-06-01',
    });
    expect(n.recipientUserId).toBe('u1');
    expect(n.referenceId).toBeNull();
    expect(n.metadata).toEqual({ eventId: 'event-1', date: '2026-05-14' });
    expect(n.read).toBe(false);
  });
});

describe('rowToCalendarEventReaction', () => {
  it('maps event reactions and normalizes values', () => {
    const reaction = rowToCalendarEventReaction({
      id: 'reaction-1',
      event_id: 'event-1',
      user_id: 'u1',
      notification_id: 'n1',
      value: 'down',
      created_at: '2026-05-14T12:00:00Z',
      updated_at: '2026-05-14T12:01:00Z',
    });
    expect(reaction.eventId).toBe('event-1');
    expect(reaction.notificationId).toBe('n1');
    expect(reaction.value).toBe('down');
    expect(reaction.updatedAt).toBe('2026-05-14T12:01:00Z');
  });
});
