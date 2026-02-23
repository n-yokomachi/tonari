import * as THREE from 'three'
import { GestureDefinition } from './types'

/**
 * 考えるポーズ（顎に手を当てる） - 考え中・相談を受けた時
 *
 * Similar to 'cover_mouth' but with a slight head tilt and
 * the hand positioned lower (at chin rather than mouth).
 */
export const thinkGesture: GestureDefinition = {
  keyframes: [
    {
      duration: 0.6,
      bones: [
        // Slight head tilt (curious/thinking look)
        {
          bone: 'neck',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.05, 0, 0.1)
          ),
        },
        // Right arm forward and slightly up to chin
        {
          bone: 'rightUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.35, -0.15, 0.25)
          ),
        },
        // Elbow bent to bring hand to chin level
        {
          bone: 'rightLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(1.3, 0.9, -0.2)
          ),
        },
        // Hand relaxed at chin
        {
          bone: 'rightHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.2, -0.1, -0.2)
          ),
        },
      ],
    },
  ],
  holdDuration: 2.5,
}
