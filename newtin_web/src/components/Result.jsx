import CountryRules from './CountryRules.jsx';

export default function Result({ result, country, raw }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <div className="result valid" role="status">
        <svg className="result-icon" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#1f8a5b" />
          <path
            d="M7 12.5l3 3 7-7"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h3>Valid TIN structure</h3>
        <p>
          The identifier matches the published structure for{' '}
          <strong>{country.name}</strong>.
        </p>
        <dl className="meta">
          <dt>Country</dt>
          <dd>
            {country.name} ({country.code})
          </dd>
          <dt>Normalized</dt>
          <dd>{result.normalized}</dd>
          <dt>Length</dt>
          <dd>{result.length} characters</dd>
          <dt>Composition</dt>
          <dd>{result.chars}</dd>
        </dl>
      </div>
    );
  }
  if (result.reason === 'no-country') {
    return (
      <div className="result invalid" role="alert">
        <svg className="result-icon" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#c1342e" />
          <path
            d="M12 7v6M12 16.5v.01"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <h3>Please select a country</h3>
        <p>The TIN structure is country-specific. Pick one to continue.</p>
      </div>
    );
  }
  if (result.reason === 'empty') {
    return (
      <div className="result invalid" role="alert">
        <svg className="result-icon" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#c1342e" />
          <path
            d="M12 7v6M12 16.5v.01"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <h3>Enter a TIN to validate</h3>
        <p>The TIN field cannot be empty.</p>
      </div>
    );
  }
  return (
    <div className="result invalid" role="alert">
      <svg className="result-icon" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#c1342e" />
        <path
          d="M8.5 8.5l7 7M15.5 8.5l-7 7"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <h3>Invalid TIN structure</h3>
      <p>{result.why || 'The value does not match the expected format.'}</p>
      <dl className="meta">
        <dt>Country</dt>
        <dd>
          {country.name} ({country.code})
        </dd>
        <dt>You entered</dt>
        <dd>{raw}</dd>
        <dt>Length</dt>
        <dd>{result.length} characters</dd>
        <dt>Example</dt>
        <dd>{country.example}</dd>
      </dl>
      <CountryRules country={country} />
    </div>
  );
}
