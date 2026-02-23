import { GestureDefinition } from './types'

/**
 * 口を覆う - 驚いた時のリアクション
 *
 * Pose data from VRM Pose Transmitter tool (.vrma file).
 * Applied to normalized bones via VRM animation pipeline.
 */
export const coverMouthGesture: GestureDefinition = {
  keyframes: [{ duration: 0.4, bones: [] }],
  holdDuration: 1.5,
  vrmaUrl: '/gestures/cover_mouth.vrma',
}
