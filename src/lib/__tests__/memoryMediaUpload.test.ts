const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockStorageFrom = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  getInfoAsync: mockGetInfoAsync,
  readAsStringAsync: mockReadAsStringAsync,
}));

jest.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: mockStorageFrom,
    },
  },
}));

jest.mock('../compressImage', () => ({
  compressImage: jest.fn(async (uri: string) => uri),
}));

import {
  getAudioContentType,
  getAudioExtension,
  getImageContentType,
  uploadMemoryAudio,
} from '../memoryMediaUpload';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(1_715_000_000_000);
  jest.spyOn(Math, 'random').mockReturnValue(0.123456);

  mockGetInfoAsync.mockResolvedValue({ exists: true, size: 4096 });
  mockReadAsStringAsync.mockResolvedValue('aGVsbG8=');
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/user-1/voice/1715000000000_4fzyo8.m4a' } });
  mockStorageFrom.mockReturnValue({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('memory media upload helpers', () => {
  it('uploads voice files with an audio content type and retry-safe upsert', async () => {
    const publicUrl = await uploadMemoryAudio('file:///recordings/voice.m4a', { prefix: 'user-1/voice' });

    expect(publicUrl).toBe('https://cdn.test/user-1/voice/1715000000000_4fzyo8.m4a');
    expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///recordings/voice.m4a');
    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///recordings/voice.m4a', { encoding: 'base64' });
    expect(mockStorageFrom).toHaveBeenCalledWith('Memories');
    expect(mockUpload).toHaveBeenCalledWith(
      'user-1/voice/1715000000000_4fzyo8.m4a',
      expect.any(ArrayBuffer),
      { contentType: 'audio/mp4', upsert: true },
    );
  });

  it('retries transient upload failures before returning the public URL', async () => {
    mockUpload
      .mockResolvedValueOnce({ error: { message: 'network unavailable' } })
      .mockResolvedValueOnce({ error: null });

    const publicUrl = await uploadMemoryAudio('file:///recordings/voice.m4a', { prefix: 'user-1/voice' });

    expect(publicUrl).toBe('https://cdn.test/user-1/voice/1715000000000_4fzyo8.m4a');
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it('rejects missing local files before reading or uploading', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: false });

    await expect(uploadMemoryAudio('file:///recordings/missing.m4a', { prefix: 'user-1/voice' }))
      .rejects.toThrow('selected media file is no longer available');

    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects empty local files before reading or uploading', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 0 });

    await expect(uploadMemoryAudio('file:///recordings/empty.m4a', { prefix: 'user-1/voice' }))
      .rejects.toThrow('selected media file was empty');

    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('keeps audio and image MIME types aligned with Supabase storage allowlists', () => {
    expect(getAudioExtension('file:///recordings/note.caf')).toBe('caf');
    expect(getAudioContentType('caf')).toBe('audio/x-caf');
    expect(getAudioContentType('m4a')).toBe('audio/mp4');
    expect(getImageContentType('jpg')).toBe('image/jpeg');
  });
});
