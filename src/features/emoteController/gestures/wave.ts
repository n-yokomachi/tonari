import * as THREE from 'three'
import { GestureDefinition } from './types'

/**
 * 手を振る - カジュアルな挨拶・お別れ
 *
 * Right arm raised to shoulder height, hand waves back and forth.
 * Uses multiple keyframes for the waving motion.
 * rightUpperArm Z+ = raise arm sideways (away from body)
 */
export const waveGesture: GestureDefinition = {
  keyframes: [
    // Raise arm up to the side
    {
      duration: 0.4,
      bones: [
        {
          bone: 'neck',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0, 0.05)
          ),
        },
        // Raise right arm sideways and slightly forward
        {
          bone: 'rightUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.1, -0.1, 0.7)
          ),
        },
        // Bend elbow upward
        {
          bone: 'rightLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.8, 0.6, -0.3)
          ),
        },
        {
          bone: 'rightHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0.2, 0)
          ),
        },
      ],
    },
    // Wave right
    {
      duration: 0.2,
      bones: [
        {
          bone: 'rightUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.1, -0.1, 0.7)
          ),
        },
        {
          bone: 'rightLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.8, 0.6, -0.3)
          ),
        },
        {
          bone: 'rightHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0.4, 0.2)
          ),
        },
      ],
    },
    // Wave left
    {
      duration: 0.2,
      bones: [
        {
          bone: 'rightUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.1, -0.1, 0.7)
          ),
        },
        {
          bone: 'rightLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.8, 0.6, -0.3)
          ),
        },
        {
          bone: 'rightHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, -0.2, -0.2)
          ),
        },
      ],
    },
    // Wave right again
    {
      duration: 0.2,
      bones: [
        {
          bone: 'rightUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.1, -0.1, 0.7)
          ),
        },
        {
          bone: 'rightLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.8, 0.6, -0.3)
          ),
        },
        {
          bone: 'rightHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0.4, 0.2)
          ),
        },
      ],
    },
  ],
  holdDuration: 0.5,
}
