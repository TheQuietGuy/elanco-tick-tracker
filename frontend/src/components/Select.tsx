import type { City } from '../types';
export function LocationSelect({ id, value, onChange, cities, allLabel = 'All locations', label = 'Location' }: { id: string; value: string; onChange: (v: string) => void; cities: City[]; allLabel?: string; label?: string }) {
  return (<div className="field"><label htmlFor={id}>{label}</label>
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>{[...cities].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
    </select></div>);
}
