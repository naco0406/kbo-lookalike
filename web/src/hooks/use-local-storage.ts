import { useState, useCallback, useEffect } from 'react';

// ── Same-tab sync via custom event ──
// localStorage의 StorageEvent는 다른 탭에서만 발생하므로,
// 같은 탭 내에서 key별 구독자를 동기화하기 위해 custom event를 사용한다.

const SYNC_EVENT = 'ls-sync';

interface SyncDetail {
  key: string;
  value: string | null;
}

const emitSync = (key: string, value: string | null) => {
  window.dispatchEvent(new CustomEvent<SyncDetail>(SYNC_EVENT, { detail: { key, value } }));
};

/**
 * Type-safe localStorage hook with same-tab + cross-tab sync.
 *
 * 같은 key를 쓰는 모든 컴포넌트가 항상 같은 값을 보게 된다:
 * - 같은 탭: CustomEvent로 동기화
 * - 다른 탭: StorageEvent로 동기화
 */
export const useLocalStorage = <T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          const serialized = JSON.stringify(next);
          localStorage.setItem(key, serialized);
          // 같은 탭 내 다른 hook 인스턴스에 알림
          emitSync(key, serialized);
        } catch {
          // quota exceeded — silently ignore
        }
        return next;
      });
    },
    [key],
  );

  // Same-tab sync: 다른 컴포넌트에서 같은 key를 변경했을 때
  useEffect(() => {
    const onSync = (e: Event) => {
      const { detail } = e as CustomEvent<SyncDetail>;
      if (detail.key !== key) return;
      try {
        setStoredValue(
          detail.value !== null ? (JSON.parse(detail.value) as T) : initialValue,
        );
      } catch {
        // ignore
      }
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [key, initialValue]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        setStoredValue(e.newValue !== null ? (JSON.parse(e.newValue) as T) : initialValue);
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, initialValue]);

  return [storedValue, setValue];
};
