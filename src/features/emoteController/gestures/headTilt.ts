import * as THREE from 'three'
import { GestureDefinition } from './types'

/**
 * 首かしげ - 好奇心・疑問・興味
 *
 * Simple neck tilt using Z rotation (roll = sideways tilt).
 * Based on the neck/spine axis conventions confirmed by 'bow' gesture.
 */
export const headTiltGesture: GestureDefinition = {
  keyframes: [
    {
      duration: 0.5,
      bones: [
        // Tilt head to the right (Z+ = tilt right)
        {
          bone: 'neck',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.05, 0, 0.2)
          ),
        },
        // Slight body follow
        {
          bone: 'chest',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0, 0.05)
          ),
        },
      ],
    },
  ],
  holdDuration: 1.5,
}
