import * as THREE from 'three'
import { GestureDefinition } from './types'

/** お辞儀（約30度） - 挨拶・感謝・お詫び */
export const bowGesture: GestureDefinition = {
  keyframes: [
    {
      duration: 1.0,
      bones: [
        {
          bone: 'spine',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.25, 0, 0)
          ),
        },
        {
          bone: 'chest',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.15, 0, 0)
          ),
        },
        {
          bone: 'neck',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.12, 0, 0)
          ),
        },
        {
          bone: 'rightShoulder',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, -0.2, -0.0)
          ),
        },
        {
          bone: 'rightUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0.1, -0.1)
          ),
        },
        {
          bone: 'rightLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.15, 1.5, 0.5)
          ),
        },
        {
          bone: 'rightHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.6, 0.2, 0.7)
          ),
        },
        {
          bone: 'leftShoulder',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0.2, -0.0)
          ),
        },
        {
          bone: 'leftUpperArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, -0.1, 0.1)
          ),
        },
        {
          bone: 'leftLowerArm',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-0.15, -1.5, -0.7)
          ),
        },
        {
          bone: 'leftHand',
          rotation: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.6, -0.2, -0.7)
          ),
        },
      ],
    },
  ],
  holdDuration: 1.0,
  closeEyes: true,
}
