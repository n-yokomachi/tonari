import { useState } from 'react'
import homeStore from '@/features/stores/home'
import type { EntranceAnimationType } from '@/features/vrmViewer/viewer'

const ANIMATIONS: { type: EntranceAnimationType; label: string }[] = [
  { type: 'softRise', label: 'Soft Rise' },
  { type: 'dissolve', label: 'Dissolve' },
  { type: 'particle', label: 'Particle' },
  { type: 'glitch', label: 'Glitch' },
  { type: 'bloom', label: 'Bloom' },
]

export const EntranceTestPanel = () => {
  const [open, setOpen] = useState(false)

  const handlePlay = (type: EntranceAnimationType) => {
    const viewer = homeStore.getState().viewer
    viewer?.playEntranceAnimation(undefined, type)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full hover:bg-black/80 transition-colors"
      >
        Entrance Test
      </button>
    )
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-black/70 backdrop-blur-sm text-white rounded-xl p-3 min-w-[160px]">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold">Entrance Animation</span>
        <button
          onClick={() => setOpen(false)}
          className="text-white/60 hover:text-white text-sm leading-none"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {ANIMATIONS.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => handlePlay(type)}
            className="bg-white/15 hover:bg-white/25 active:bg-white/35 text-xs px-3 py-1.5 rounded-lg transition-colors text-left"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
