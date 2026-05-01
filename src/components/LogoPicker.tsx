import { useState, useRef } from 'react';
import { FORTUNE500, Company } from '../data/fortune500';

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  onNameChange?: (name: string | null) => void;
}

// Preview sources tried in order via <img> onError (no CORS needed for display).
function previewSrcs(domain: string) {
  return [
    `https://logo.clearbit.com/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  ];
}

// onClick receives the URL that actually loaded (or null if all sources failed) and company name.
function LogoItem({
  company,
  onClick,
}: {
  company: Company;
  onClick: (loadedSrc: string | null, name: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const srcs = previewSrcs(company.domain);
  const allFailed = idx >= srcs.length;

  return (
    <button
      className="logo-item"
      onClick={() => onClick(allFailed ? null : srcs[idx], company.name)}
      title={company.name}
    >
      {allFailed ? (
        <div className="logo-item-fallback">{company.name.charAt(0)}</div>
      ) : (
        <img
          key={idx}
          src={srcs[idx]}
          alt={company.name}
          className="logo-item-img"
          onError={() => setIdx((i) => i + 1)}
        />
      )}
      <span className="logo-item-name">{company.name}</span>
    </button>
  );
}

export function LogoPicker({ value, onChange, onNameChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered =
    query.trim().length === 0
      ? FORTUNE500.slice(0, 24)
      : FORTUNE500.filter((c) =>
          c.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 30);

  // Receives the URL that successfully loaded and company name.
  function selectCompany(loadedSrc: string | null, name: string) {
    if (!loadedSrc) return;
    onChange(loadedSrc);
    onNameChange?.(name);
    setOpen(false);
    setQuery('');
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange(ev.target?.result as string);
      onNameChange?.(null);
      setOpen(false);
      setQuery('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="logo-picker">
      {value ? (
        <div className="logo-picker-selected">
          <img src={value} alt="Logo" className="logo-selected-thumb" />
          <div className="logo-picker-selected-actions">
            <button className="btn-ghost-sm" onClick={() => setOpen((o) => !o)}>Change</button>
            <button
              className="btn-ghost-sm"
              onClick={() => {
                onChange(null);
                onNameChange?.(null);
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-logo-add" onClick={() => setOpen((o) => !o)}>
          <span className="btn-logo-add-icon">+</span> Add company logo
        </button>
      )}

      {open && (
        <div className="logo-picker-panel">
          <div className="logo-search-bar">
            <input
              className="logo-search-input"
              type="text"
              placeholder="Search Fortune 500…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <label className="btn-ghost-sm">
              Upload
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleUpload}
              />
            </label>
            <button className="btn-ghost-sm" onClick={close}>✕</button>
          </div>

          {query.trim().length === 0 && (
            <p className="logo-grid-hint">Popular companies — or type to search</p>
          )}

          <div className="logo-grid">
            {filtered.map((company) => (
              <LogoItem key={company.domain} company={company} onClick={selectCompany} />
            ))}
            {filtered.length === 0 && (
              <p className="logo-no-results">No match — try uploading your logo.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
