import * as THREE from 'three'

class CustomMaterial extends THREE.ShaderMaterial {
    constructor( arg ) {
        super( arg )
        this.uniforms.resolution = { type: 'v2', value: new THREE.Vector2() }
    }

    set size ( v ) {
        this.uniforms.resolution.value.x = v[ 0 ]
        this.uniforms.resolution.value.y = v[ 1 ]
    }
}

export default CustomMaterial