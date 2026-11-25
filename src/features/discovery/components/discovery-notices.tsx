export function DiscoveryNotices({
  searchError,
  searchErrorId,
  urlError,
  loadError,
  onClear,
  onRetry,
}: Readonly<{
  searchError: string | null;
  searchErrorId: string;
  urlError: string | null;
  loadError: boolean;
  onClear: () => void;
  onRetry: () => void;
}>) {
  if (!searchError && !urlError && !loadError) {
    return null;
  }

  return (
    <div className="discovery-notices">
      {searchError && (
        <div id={searchErrorId} className="notice" role="alert">
          <p>{searchError}</p>
        </div>
      )}
      {urlError && (
        <div className="notice" role="alert">
          <p>{urlError}</p>
          <button type="button" onClick={onClear}>
            Reset invalid filters
          </button>
        </div>
      )}
      {loadError && (
        <div className="notice" role="alert">
          <p>
            Could not refresh discovery results. Showing the last available
            list.
          </p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
