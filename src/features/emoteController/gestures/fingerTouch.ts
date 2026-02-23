import * as THREE from 'three'
import { GestureDefinition } from './types'

/**
 * 人差し指合わせ - 悲しみ・申し訳なさ・しょんぼり
 *
 * Based on 'bow' gesture's two-handed position but less folded,
 * bringing hands together at chest level.
 * Mirror pattern: left values = right values with Y and Z sign-flipped.
 */
export const fingerTouchGesture: GestureDefinition = {
  keyframes: [
    {
      duration: 0.7,
      bones: [
        // Slightly lowered head (dejected look)
        {
          bone: 'neck',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.12, 0, 0)
          ),
        },
        // Right arm: brought forward and inward
        {
          bone: 'rightUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.2, 0.15, -0.15)
          ),
        },
        // Right elbow: bent inward (Y+ = inward bend, similar to bow)
        {
          bone: 'rightLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.1, 1.2, 0.3)
          ),
        },
        {
          bone: 'rightHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.3, 0.1, 0.4)
          ),
        },
        // Left arm: mirror of right
        {
          bone: 'leftUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.2, -0.15, 0.15)
          ),
        },
        {
          bone: 'leftLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-0.1, -1.2, -0.3)
          ),
        },
        {
          bone: 'leftHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.3, -0.1, -0.4)
          ),
        },
      ],
    },
  ],
  holdDuration: 2.0,
}
