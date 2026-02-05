import * as THREE from 'three';
import { PlayerState } from '../movement/PmoveTypes';

export class CameraRig {
  apply(camera: THREE.PerspectiveCamera, state: PlayerState, yaw: number, pitch: number): void {
    camera.position.set(
      state.position.x,
      state.position.y,
      state.position.z + state.viewHeight
    );
    camera.rotation.order = 'YXZ';
    camera.rotation.y = (yaw * Math.PI) / 180;
    camera.rotation.x = (pitch * Math.PI) / 180;
  }
}
