import { useStore } from '../store'

const SYMBOL: Record<string, string> = { USD: '$', NGN: '₦', EUR: '€', GBP: '£', GHS: '₵', KES: 'KSh', ZAR: 'R', INR: '₹', CAD: 'C$' }
const sym = (c: string) => SYMBOL[c] ?? c

// Switch every total between the main currency and a second one (set in Settings).
export function CurrencySwitch() {
  const { data, view, setShowAlt } = useStore()
  if (!view.canSwitch) return null
  const base = data.settings.baseCurrency
  const title = view.altRate ? `1 ${base} = ${view.altRate.toLocaleString()} ${view.altCurrency}` : ''
  return (
    <div className="segmented currency-switch" role="group" aria-label={`Show totals in. ${title}`} title={title}>
      <button className={!view.showingAlt ? 'active' : ''} aria-pressed={!view.showingAlt} onClick={() => setShowAlt(false)}>
        {sym(base)} <span className="cur-code">{base}</span>
      </button>
      <button className={view.showingAlt ? 'active' : ''} aria-pressed={view.showingAlt} onClick={() => setShowAlt(true)}>
        {sym(view.altCurrency)} <span className="cur-code">{view.altCurrency}</span>
      </button>
    </div>
  )
}
