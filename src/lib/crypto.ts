let cachedKey: CryptoKey | null = null;
let keyPromise: Promise<CryptoKey> | null = null;

const LEGACY_KEY_STRING =
  "MARGYN_SECURE_ENCRYPTION_LAYER_v1.0.0_9x8f7g6h5j4k3l2";

function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importKey(
  keyString: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretData = encoder.encode(keyString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", secretData);
  return await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false,
    usages,
  );
}

// ✅ کلید per-install (محافظت‌شده با safeStorage)
async function getCryptoKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  if (keyPromise) return keyPromise;

  keyPromise = (async () => {
    let keyString: string;

    if (window.electronAPI?.getCryptoKey) {
      keyString = await window.electronAPI.getCryptoKey();
    } else {
      // fallback برای dev/browser
      keyString = "MARGYN_BROWSER_DEV_KEY_NOT_SECURE";
    }

    cachedKey = await importKey(keyString, ["encrypt", "decrypt"]);
    return cachedKey;
  })();

  return keyPromise;
}

// ✅ کلید قدیمی برای backward compat
async function getLegacyKey(): Promise<CryptoKey> {
  return await importKey(LEGACY_KEY_STRING, ["decrypt"]);
}

export async function encryptData(data: any): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getCryptoKey();

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      dataBuffer,
    );

    const combinedBuffer = new Uint8Array(
      iv.length + encryptedBuffer.byteLength,
    );
    combinedBuffer.set(iv, 0);
    combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

    return bufferToBase64(combinedBuffer.buffer);
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt data");
  }
}

export async function decryptData(encryptedBase64: string): Promise<any> {
  const combinedBuffer = base64ToBuffer(encryptedBase64);
  const iv = combinedBuffer.slice(0, 12);
  const dataBuffer = combinedBuffer.slice(12);
  const decoder = new TextDecoder();

  // ✅ ابتدا با کلید جدید
  try {
    const key = await getCryptoKey();
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      dataBuffer,
    );
    return JSON.parse(decoder.decode(decryptedBuffer));
  } catch (newKeyError) {
    // ✅ اگر fail شد، با کلید legacy
    try {
      const legacyKey = await getLegacyKey();
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        legacyKey,
        dataBuffer,
      );
      return JSON.parse(decoder.decode(decryptedBuffer));
    } catch (legacyError) {
      console.error("Decryption failed with both keys");
      throw new Error(
        "Failed to decrypt data. File might be corrupted or tampered.",
      );
    }
  }
}
