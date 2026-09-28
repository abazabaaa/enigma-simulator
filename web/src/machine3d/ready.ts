/**
 * The 3D machine exists (PR 06): StageHost renders it when WebGL 2 is available and neither
 * ?stage=2d nor the '2d' preference is set. StageHost imports this flag statically, so this file
 * imports nothing.
 */
export const MACHINE_3D_READY: boolean = true
