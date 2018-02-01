import vec2 from  'gl-vec2'
import loop from 'raf-loop'
import remap from 'remap'
import * as THREE from 'three'
import createOrbitControls from 'three-orbit-controls'
import CustomMaterial from './lib/CustomMaterial'
import { MeshBasicMaterial } from 'three';
import dat from 'dat-gui'
import mat4 from 'gl-mat4'

const OrbitControls = createOrbitControls( THREE )
const glslify = require( 'glslify' )
const gui = new dat.GUI()

class App {

    constructor( data ) {
        this.mouse = vec2.create()
        this.engine = loop( this.tick.bind( this ) )
        this.winSize = [ window.innerWidth, window.innerHeight ]
        this.useOrtho = false
        this.setupScene()
        this.resize()
        this.sideBySide = false
        window.addEventListener( 'resize', this.resize.bind( this ) )
    }

    setupScene() {

        this.scene = new THREE.Scene()
        this.renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } )
        this.rendererSDF = new THREE.WebGLRenderer( { antialias: true, alpha: true } )
        this.renderer.domElement.id = 'main-canvas'
        this.rendererSDF.domElement.id = 'sdf-canvas'
        this.renderer.setPixelRatio( window.devicePixelRatio )
        this.rendererSDF.setPixelRatio( window.devicePixelRatio )

        this.scene.add( new THREE.AxesHelper( 40 ) )

        this.renderCamera = new THREE.OrthographicCamera(-1,1,1,-1,1/Math.pow( 2, 53 ),1);


        this.geom = new THREE.BufferGeometry();
        this.geom.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array([ -1,-1,0, 1,-1,0, 1,1,0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3 ) );
        this.mesh = new THREE.Mesh( this.geom, new THREE.MeshBasicMaterial( { color: 0xff0000 } ) );
        this.scene.add( this.mesh );

        //some helpers
        this.camera = new THREE.PerspectiveCamera(1, 1, 0.01,100000 );
        // this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0.001, 1000 )
        this.target = new THREE.Vector3()
        this.camera.position.set( 0, 0, 500.0 )
        this.camera.lookAt( this.target )
        this.controls = new OrbitControls( this.camera, this.renderer.domElement )
        this.material = new CustomMaterial({
            uniforms: {
                time:{ type:"f", value:0 },
                randomSeed:{ type:"f", value:Math.random() },
                _cameraPosition:{ type:"v3", value:this.camera.position },
                _cameraViewMatrix: { type: 'm4', value: new THREE.Matrix4() },
                _cameraInvProjectionMatrix: { type: 'm4', value: new THREE.Matrix4() },
                target:{ type:"v3", value:this.target },
                raymarchMaximumDistance:{ type:"f", value:this.distance },
                raymarchPrecision:{ type:"f", value:this.precision},
                // clipToWorld: { type: 'm4', value: new THREE.Matrix4() }
            },
            fragmentShader: glslify( './lib/shaders/sdf.frag' ),
            vertexShader: glslify(`
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }`, { inline : true })
        })

        this._worldToClip = new Float32Array(16)
        this.material.size = [this.winSize[0] / 2, this.winSize[1]]
        this.mesh.material = this.material
        this.debugMaterial = new MeshBasicMaterial({wireframe: true,color: 0xff0000})
        // this.mesh.material.wireframe = true
        // this.mesh.material = new THREE.MeshBasicMaterial( {color: 0xff0000 })

        if ( this.camera instanceof THREE.PerspectiveCamera ) {
            gui.add( this.camera, 'fov', 0.01, 90.0 ).onChange(() => this.camera.updateProjectionMatrix())
        }
    }

    appendTo( p ) {
        p.appendChild( this.renderer.domElement )
        p.appendChild( this.rendererSDF.domElement )
    }

    tick() {
        this.controls.update()
        this.material.uniforms.target.value = this.controls.target
        this.material.uniforms._cameraPosition.value = this.camera.position

        // https://www.gamasutra.com/blogs/DavidArppe/20170405/295240/How_to_get_Stunning_Graphics_with_Raymarching_in_Games.php
        this.material.uniforms._cameraViewMatrix.value = this.camera.matrixWorld

        let invProjectionMat = new THREE.Matrix4()
        invProjectionMat.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        let a = this.camera.projectionMatrix.elements[0];
        let b = this.camera.projectionMatrix.elements[5];
        let c = this.camera.projectionMatrix.elements[10];
        let d = this.camera.projectionMatrix.elements[14];
        let e = this.camera.projectionMatrix.elements[11];
        invProjectionMat.elements[0] = 1.0 / a;
        invProjectionMat.elements[5] = 1.0 / b;
        invProjectionMat.elements[11] = 1.0 / d;
        invProjectionMat.elements[14] = 1.0 / e;
        invProjectionMat.elements[15] = -c / (d * e);

        this.material.uniforms._cameraInvProjectionMatrix.value = invProjectionMat
        // this.material.uniforms.clipToWorld.value.set.apply(this.material.uniforms.clipToWorld.value, mat4.invert(this._worldToClip, this._worldToClip))

        this.mesh.material = this.debugMaterial
        this.renderer.render( this.scene, this.camera )

        this.mesh.material = this.material
        this.rendererSDF.render( this.scene, this.renderCamera )
        // console.log(this.controls.target)
    }

    resize() {
        this.winSize[ 0 ] = window.innerWidth
        this.winSize[ 1 ] = window.innerHeight
        let factor = (this.sideBySide ? 2.0 : 1.0)
        this.camera.aspect =  this.winSize[ 0 ] / factor / this.winSize[ 1 ]
        let size = [this.winSize[0] / factor * this.renderer.getPixelRatio(), this.winSize[1] * this.renderer.getPixelRatio()]
        this.material.size = size

        if ( this.camera instanceof THREE.OrthographicCamera ) {
            let camFactor = 2
            this.camera.left = -size[ 0 ] / camFactor;
            this.camera.right = size[ 0 ] / camFactor;
            this.camera.top = size[ 1 ] / camFactor;
            this.camera.bottom = -size[ 1 ] / camFactor;
            console.log('ya')
            this.camera.updateProjectionMatrix();
        }
        
        this.camera.updateProjectionMatrix()
        this.renderer.setSize( this.winSize[ 0 ] / factor, this.winSize[ 1 ] )
        this.rendererSDF.setSize( this.winSize[ 0 ] / factor, this.winSize[ 1 ] )
    }

    set sideBySide( v ) {
        this._sideBySide = v
        if ( v ) {
            document.body.classList.add( 'side-by-side' )
        } else {
            document.body.classList.remove( 'side-by-side' )
        }
        this.resize()
    }

    get sideBySide() {
        return this._sideBySide
    }
}

export default App