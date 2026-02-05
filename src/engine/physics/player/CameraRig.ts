import * as THREE from 'three';
import { PlayerState } from '../movement/PmoveTypes';

const tmpForward = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();

export class CameraRig {
  apply(camera: THREE.PerspectiveCamera, state: PlayerState, yaw: number, pitch: number): void {
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    const cosPitch = Math.cos(pitchRad);

    tmpForward.set(
      Math.cos(yawRad) * cosPitch,
      Math.sin(yawRad) * cosPitch,
      -Math.sin(pitchRad)
    );

    camera.up.set(0, 0, 1);
    camera.position.set(
      state.position.x,
      state.position.y,
      state.position.z + state.viewHeight
    );
    tmpTarget.copy(camera.position).add(tmpForward);
    camera.lookAt(tmpTarget);
  }
}
