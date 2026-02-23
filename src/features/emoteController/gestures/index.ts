import { GestureDefinition, GestureType } from './types'
import { bowGesture } from './bow'
import { presentGesture } from './present'
import { coverMouthGesture } from './coverMouth'
import { fingerTouchGesture } from './fingerTouch'
import { thinkGesture } from './think'
import { waveGesture } from './wave'
import { cheerGesture } from './cheer'
import { headTiltGesture } from './headTilt'

export type {
  GestureType,
  GestureDefinition,
  BoneRotation,
  GestureKeyframe,
} from './types'
export type { VrmaPose } from './loadVrmaPose'
export { loadVrmaPose } from './loadVrmaPose'

/** All gesture definitions keyed by type */
export const gestureDefinitions: ReadonlyMap<GestureType, GestureDefinition> =
  new Map<GestureType, GestureDefinition>([
    ['bow', bowGesture],
    ['present', presentGesture],
    ['cover_mouth', coverMouthGesture],
    ['finger_touch', fingerTouchGesture],
    ['think', thinkGesture],
    ['wave', waveGesture],
    ['cheer', cheerGesture],
    ['head_tilt', headTiltGesture],
  ])

/** All gesture type names (excluding 'none') for tag detection */
export const GESTURE_TAGS: GestureType[] = [
  'bow',
  'present',
  'cover_mouth',
  'finger_touch',
  'think',
  'wave',
  'cheer',
  'head_tilt',
]
