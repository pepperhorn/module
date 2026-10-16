import type { Bank } from '../patches/types'
import { BANK_ORDER } from '../patches/types'

interface ButtonBankProps {
  active: Bank
  onSelect: (bank: Bank) => void
}

const SHORT: Record<Bank, string> = {
  USR: 'USR',
  GM: 'GM',
  PNO: 'PNO',
  EP: 'EP',
  MAL: 'MAL',
  MEL: 'MEL',
  BAS: 'BAS',
  CST: 'CST',
}

export function ButtonBank({ active, onSelect }: ButtonBankProps) {
  return (
    <div className="button-bank">
      <div className="button-bank-label legend mb-2">
        BANK
      </div>
      <div className="button-bank-grid grid grid-cols-4 gap-1.5">
        {BANK_ORDER.map((bank) => {
          const isActive = bank === active
          return (
            <button
              key={bank}
              type="button"
              aria-pressed={isActive}
              className={`bank-button hw-btn relative flex h-9 items-center justify-center ${
                isActive ? 'bank-button-active' : ''
              }`}
              onClick={() => onSelect(bank)}
            >
              <span
                aria-hidden="true"
                className="bank-button-led hw-btn-led absolute"
                style={{
                  top: 4,
                  right: 4,
                  ...(isActive
                    ? {
                        background: 'var(--color-coral)',
                        boxShadow: '0 0 5px rgba(255,107,107,0.8)',
                      }
                    : {}),
                }}
              />
              <span
                className="bank-button-label legend"
                style={{
                  color: isActive
                    ? 'var(--color-legend-strong)'
                    : 'var(--color-legend)',
                }}
              >
                {SHORT[bank]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
