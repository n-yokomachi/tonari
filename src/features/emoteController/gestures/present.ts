import * as THREE from 'three'
import { GestureDefinition } from './types'

/** 紹介ポーズ（右手を前に出して示す） - 提案・おすすめ紹介 */
export const presentGesture: GestureDefinition = {
  keyframes: [
    {
      duration: 0.6,
      bones: [
        {
          bone: 'neck',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-0.05, -0.2, 0.3)
          ),
        },
        {
          bone: 'chest',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.1, 0.2, -0.15)
          ),
        },
        {
          bone: 'rightShoulder',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, -0.0, -0.0)
          ),
        },
        {
          bone: 'rightUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.2, -0.3, 0.2)
          ),
        },
        {
          bone: 'rightLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(1.7, 0.5, -2.9)
          ),
        },
        {
          bone: 'rightHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, -0.5, -0.6)
          ),
        },
      ],
    },
  ],
  holdDuration: 2.0,
}
