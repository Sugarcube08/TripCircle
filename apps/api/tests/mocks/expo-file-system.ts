export const documentDirectory = '/tmp/tripcircle-test-cache/';

export const EncodingType = {
  UTF8: 'utf8',
};

const fileMemory = new Map<string, string>();

export async function getInfoAsync(path: string): Promise<{ exists: boolean }> {
  return { exists: fileMemory.has(path) };
}

export async function readAsStringAsync(path: string): Promise<string> {
  const content = fileMemory.get(path);
  if (!content) throw new Error('File not found');
  return content;
}

export async function writeAsStringAsync(path: string, content: string): Promise<void> {
  fileMemory.set(path, content);
}

export async function deleteAsync(path: string): Promise<void> {
  fileMemory.delete(path);
}
