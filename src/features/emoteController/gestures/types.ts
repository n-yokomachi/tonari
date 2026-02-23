import * as THREE from 'three'
import { VRMHumanBoneName } from '@pixiv/three-vrm'

export type GestureType =
  | 'bow'
  | 'present'
  | 'cover_mouth'
  | 'finger_touch'
  | 'think'
  | 'wave'
  | 'cheer'
  | 'head_tilt'
  | 'none'

export interface BoneRotation {
  bone: VRMHumanBoneName
  rotation: THREE.Quaternion
}

export interface GestureKeyframe {
  duration: number
  bones: BoneRotation[]
}

export interface GestureDefinition {
  keyframes: GestureKeyframe[]
  holdDuration: number
  closeEyes?: boolean
  /** Path to .vrma file for single-pose gestures (applied to normalized bones) */
  vrmaUrl?: string
  /** Paths to .vrma files for multi-pose gestures (one per keyframe, alternating between poses) */
  vrmaUrls?: string[]
}
