import { GestureDefinition } from './types'

/**
 * ガッツポーズ（小さく拳を握る） - 励まし・祝福・応援
 *
 * Pose data from VRM Pose Transmitter tool (.vrma file).
 * Applied to normalized bones via VRM animation pipeline.
 */
export const cheerGesture: GestureDefinition = {
  keyframes: [{ duration: 0.5, bones: [] }],
  holdDuration: 1.5,
  vrmaUrl: '/gestures/cheer.vrma',
}
