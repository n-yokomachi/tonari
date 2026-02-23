import { GestureDefinition } from './types'

/**
 * 手を振る - カジュアルな挨拶・お別れ
 *
 * Pose data from VRM Pose Transmitter tool (.vrma files).
 * Alternates between wave1.vrma and wave2.vrma to create waving motion.
 * Applied to normalized bones via VRM animation pipeline.
 */
export const waveGesture: GestureDefinition = {
  keyframes: [
    { duration: 0.5, bones: [] }, // idle → wave1（腕を上げる）
    { duration: 0.35, bones: [] }, // wave1 → wave2
    { duration: 0.35, bones: [] }, // wave2 → wave1
    { duration: 0.35, bones: [] }, // wave1 → wave2
    { duration: 0.35, bones: [] }, // wave2 → wave1
    { duration: 0.35, bones: [] }, // wave1 → wave2
  ],
  holdDuration: 0.3,
  vrmaUrls: [
    '/gestures/wave1.vrma',
    '/gestures/wave2.vrma',
    '/gestures/wave1.vrma',
    '/gestures/wave2.vrma',
    '/gestures/wave1.vrma',
    '/gestures/wave2.vrma',
  ],
}
