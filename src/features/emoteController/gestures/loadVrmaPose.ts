import * as THREE from 'three'
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import { loadVRMAnimation } from '@/lib/VRMAnimation/loadVRMAnimation'

export type VrmaPose = Map<VRMHumanBoneName, THREE.Quaternion>

/**
 * Load a .vrma file and extract bone rotations as normalized bone quaternions.
 *
 * The VRMAnimationLoaderPlugin transforms rotation values during parsing,
 * so the extracted quaternions are ready to be applied to VRM normalized bone nodes.
 */
export async function loadVrmaPose(url: string, vrm: VRM): Promise<VrmaPose> {
  const vrmAnimation = await loadVRMAnimation(url)
  if (!vrmAnimation) throw new Error(`Failed to load VRMA: ${url}`)

  const pose = new Map<VRMHumanBoneName, THREE.Quaternion>()
  const metaVersion = vrm.meta.metaVersion

  for (const [boneName, track] of vrmAnimation.humanoidTracks.rotation) {
    const values = track.values
    if (values.length >= 4) {
      let x = values[0],
        y = values[1],
        z = values[2],
        w = values[3]
      // VRM 0.x sign correction (same as VRMAnimation.createAnimationClip)
      if (metaVersion === '0') {
        x = -x
        z = -z
      }
      pose.set(boneName, new THREE.Quaternion(x, y, z, w))
    }
  }

  return pose
}
