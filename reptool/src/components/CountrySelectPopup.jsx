import ListSelectPopup from './ListSelectPopup.jsx'
import { COUNTRIES } from '../data/countries.js'

const COUNTRY_ITEMS = COUNTRIES.map(c => ({ value: c.code, label: c.name, badge: c.code }))

export default function CountrySelectPopup({ value, anchor, onCommit, onCancel }) {
  return (
    <ListSelectPopup
      items={COUNTRY_ITEMS}
      value={value}
      anchor={anchor}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  )
}
