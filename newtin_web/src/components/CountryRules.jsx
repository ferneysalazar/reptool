import { useState } from 'react';

export default function CountryRules({ country }) {
  const [open, setOpen] = useState(false);
  const description =
    country.description ||
    `The TIN for ${country.name} follows a published structure based on its expected format (${country.format}). The validator checks types and number of characters against this published structure.`;
  const rules = country.rules || [
    `Expected structure: ${country.format}.`,
    'Only the character types defined by the format are allowed (digits, letters, or both).',
    'Whitespace and separators are normalized before validation.',
    'Length must match the published rule from the country’s tax authority.',
  ];
  return (
    <div className="accordion">
      <button
        type="button"
        className="accordion-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide country rules' : 'Show country rules'}
        <svg className="caret" viewBox="0 0 10 6" fill="none">
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className={`accordion-panel ${open ? 'open' : ''}`}>
        <div className="accordion-body">
          <h4>{country.name} — TIN structure</h4>
          <p>{description}</p>
          <h4>Validation rules</h4>
          <ul>
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <h4>Quick reference</h4>
          <dl className="rule-row">
            <dt>Country code</dt>
            <dd>{country.code}</dd>
            <dt>Example</dt>
            <dd>
              <code>{country.example}</code>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
