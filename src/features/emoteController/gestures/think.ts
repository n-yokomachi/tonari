import { GestureDefinition } from './types'

/**
 * 考えるポーズ（顎に手を当てる） - 考え中・相談を受けた時
 *
 * Pose data from VRM Pose Transmitter tool (.vrma file).
 * Applied to normalized bones via VRM animation pipeline.
 */
export const thinkGesture: GestureDefinition = {
  keyframes: [{ duration: 0.6, bones: [] }],
  holdDuration: 2.5,
  vrmaUrl: '/gestures/think.vrma',
}
