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
      <div className="button-bank-label mb-2 font-mono text-[9px] uppercase tracking-widest text-text/50">
        BANK
      </div>
      <div className="button-bank-grid grid grid-cols-4 gap-1.5">
        {BANK_ORDER.map((bank) => {
          const isActive = bank === active
          return (
            <button
              key={bank}
              type="button"
              className={`bank-button cell-hit relative h-9 rounded-md font-display text-xs font-medium uppercase tracking-wider ${
                isActive
                  ? 'bank-button-active text-bg shadow-inner'
                  : 'bg-white text-text/70 hover:text-text'
              }`}
              style={
                isActive
                  ? {
                      background:
                        'linear-gradient(180deg, var(--color-coral) 0%, #E55A5A 100%)',
                      boxShadow:
                        'inset 0 -2px 0 rgba(0,0,0,0.18), 0 0 10px rgba(255,107,107,0.3)',
                    }
                  : {
                      background:
                        'linear-gradient(180deg, #FFFFFF 0%, #F2F4F8 100%)',
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(20,30,60,0.1)',
                      border: '1px solid var(--color-rack-edge)',
                    }
              }
              onClick={() => onSelect(bank)}
            >
              {SHORT[bank]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
