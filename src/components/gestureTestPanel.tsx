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
  blow_a_kiss: '投げキス',
  thinking: '考え中',
  none: '',
}

/** フルアニメーション再生用 */
const ANIMATION_ITEMS: { label: string; url: string }[] = [
  { label: '投げキス(Anim)', url: '/gestures/blow_a_kiss.vrma' },
  { label: '考え中(Anim)', url: '/gestures/thinking_anim.vrma' },
  { label: '待機(Anim)', url: '/gestures/holding_idle.vrma' },
  { label: '見下ろし(Anim)', url: '/gestures/looking_down.vrma' },
]

export const GestureTestPanel = () => {
  const [open, setOpen] = useState(false)

  const handleGesture = (gesture: GestureType) => {
    const viewer = homeStore.getState().viewer
    viewer?.model?.playGesture(gesture)
  }

  const handleAnimation = (url: string) => {
    const viewer = homeStore.getState().viewer
    viewer?.model?.playVrmaAnimation(url)
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
      <div className="text-[10px] text-gray-400 mb-1">Pose Gestures</div>
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
      <div className="text-[10px] text-gray-400 mt-2 mb-1">Full Animations</div>
      <div className="grid grid-cols-1 gap-1.5">
        {ANIMATION_ITEMS.map((item) => (
          <button
            key={item.url}
            onClick={() => handleAnimation(item.url)}
            className="bg-blue-500/30 hover:bg-blue-500/50 text-xs px-2 py-1.5 rounded transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
