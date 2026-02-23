import * as THREE from 'three'
import { GestureDefinition } from './types'

/**
 * ガッツポーズ（小さく拳を握る） - 励まし・祝福・応援
 *
 * Right arm raised with fist, slight lean back for emphasis.
 * Based on 'wave' arm position but with fist and more energy.
 */
export const cheerGesture: GestureDefinition = {
  keyframes: [
    {
      duration: 0.5,
      bones: [
        // Slight lean back (energetic pose)
        {
          bone: 'spine',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-0.05, 0, 0)
          ),
        },
        // Right arm raised forward and up
        {
          bone: 'rightUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.3, -0.2, 0.5)
          ),
        },
        // Elbow bent with fist up
        {
          bone: 'rightLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(1.0, 0.8, -0.2)
          ),
        },
        // Fist (hand closed)
        {
          bone: 'rightHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.4, 0, 0.1)
          ),
        },
      ],
    },
  ],
  holdDuration: 1.5,
}
