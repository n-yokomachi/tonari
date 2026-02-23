import { GestureDefinition } from './types'

/**
 * 人差し指合わせ - 悲しみ・申し訳なさ・しょんぼり
 *
 * Pose data from VRM Pose Transmitter tool (.vrma file).
 * Applied to normalized bones via VRM animation pipeline.
 */
export const fingerTouchGesture: GestureDefinition = {
  keyframes: [{ duration: 0.7, bones: [] }],
  holdDuration: 2.0,
  vrmaUrl: '/gestures/finger_touch.vrma',
}
