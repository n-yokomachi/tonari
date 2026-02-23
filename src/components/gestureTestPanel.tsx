import { useState } from 'react'
import homeStore from '@/features/stores/home'
import { GESTURE_TAGS, GestureType } from '@/features/emoteController/gestures'

const GESTURE_LABELS: Record<GestureType, string> = {
  bow: 'お辞儀',
  present: '紹介',
  cover_mouth: '口覆い',
  finger_touch: '指合わせ',
  think: '考える',
  wave: '手振り',
  cheer: 'ガッツ',
  head_tilt: '首かしげ',
  none: '',
}

export const GestureTestPanel = () => {
  const [open, setOpen] = useState(false)

  const handleGesture = (gesture: GestureType) => {
    const viewer = homeStore.getState().viewer
    viewer?.model?.playGesture(gesture)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-2 right-2 z-30 bg-black/50 text-white text-xs px-2 py-1 rounded hover:bg-black/70 transition-colors"
      >
        Motion Test
      </button>
    )
  }

  return (
    <div className="absolute top-2 right-2 z-30 bg-black/70 text-white rounded-lg p-3 w-48">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold">Motion Test</span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs hover:text-gray-300"
        >
          x
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {GESTURE_TAGS.map((gesture) => (
          <button
            key={gesture}
            onClick={() => handleGesture(gesture)}
            className="bg-white/20 hover:bg-white/40 text-xs px-2 py-1.5 rounded transition-colors"
          >
            {GESTURE_LABELS[gesture]}
          </button>
        ))}
      </div>
    </div>
  )
}
