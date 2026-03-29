import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Mouse tracker ── */
var useMouse = function () {
  var mouse = useRef({ x: 0, y: 0 });
  useEffect(function () {
    var handler = function (e) {
      mouse.current.x = (e.clientX / window.innerWidth)  * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return function () { window.removeEventListener('mousemove', handler); };
  }, []);
  return mouse;
};

/* ── Floating particles ── */
var Particles = function ({ count }) {
  var mesh  = useRef();
  var mouse = useMouse();
  var n     = count || 120;

  var [positions, speeds, offsets] = useMemo(function () {
    var pos  = new Float32Array(n * 3);
    var spd  = new Float32Array(n);
    var off  = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
      spd[i] = 0.15 + Math.random() * 0.35;
      off[i] = Math.random() * Math.PI * 2;
    }
    return [pos, spd, off];
  }, [n]);

  useFrame(function (state) {
    var t = state.clock.elapsedTime;
    var geo = mesh.current.geometry;
    var arr = geo.attributes.position.array;

    for (var i = 0; i < n; i++) {
      var i3 = i * 3;
      arr[i3 + 1] = positions[i * 3 + 1] + Math.sin(t * speeds[i] + offsets[i]) * 0.8;
      arr[i3]     = positions[i * 3]     + Math.cos(t * speeds[i] * 0.6 + offsets[i]) * 0.3;
    }
    geo.attributes.position.needsUpdate = true;

    /* Slow parallax with mouse */
    mesh.current.rotation.x += (mouse.current.y * 0.012 - mesh.current.rotation.x) * 0.03;
    mesh.current.rotation.y += (mouse.current.x * 0.012 - mesh.current.rotation.y) * 0.03;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions.slice(), 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#606060"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

/* ── Grid plane ── */
var AnimatedGrid = function () {
  var mesh  = useRef();
  var mat   = useRef();
  var mouse = useMouse();

  useFrame(function (state) {
    var t = state.clock.elapsedTime;
    mat.current.opacity = 0.055 + Math.sin(t * 0.4) * 0.015;

    mesh.current.rotation.x += (mouse.current.y * 0.06 - mesh.current.rotation.x) * 0.025;
    mesh.current.rotation.z += (mouse.current.x * 0.03 - mesh.current.rotation.z) * 0.025;
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2.4, 0, 0]} position={[0, -4, -2]}>
      <planeGeometry args={[38, 26, 28, 18]} />
      <meshBasicMaterial
        ref={mat}
        color="#404040"
        wireframe
        transparent
        opacity={0.055}
        depthWrite={false}
      />
    </mesh>
  );
};

/* ── Ambient orb sphere ── */
var AmbientOrb = function ({ position, radius, speed, phase, opacity }) {
  var mesh  = useRef();
  var mat   = useRef();
  var mouse = useMouse();

  useFrame(function (state) {
    var t = state.clock.elapsedTime;
    var s = speed  || 0.25;
    var p = phase  || 0;
    var r = radius || 1.8;

    mesh.current.position.y = (position[1] || 0) + Math.sin(t * s + p) * 0.6;
    mesh.current.position.x = (position[0] || 0) + Math.cos(t * s * 0.7 + p) * 0.3;
    mat.current.opacity = (opacity || 0.07) + Math.sin(t * s * 1.2 + p) * 0.02;

    /* Mouse parallax */
    mesh.current.rotation.y += mouse.current.x * 0.004;
    mesh.current.rotation.x += mouse.current.y * 0.004;
  });

  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[radius || 1.8, 10, 10]} />
      <meshBasicMaterial
        ref={mat}
        color="#888888"
        transparent
        opacity={opacity || 0.07}
        wireframe
        depthWrite={false}
      />
    </mesh>
  );
};

/* ── Glow sphere (solid inner) ── */
var GlowOrb = function ({ position, radius, color, speed, phase }) {
  var mesh = useRef();
  var mat  = useRef();

  useFrame(function (state) {
    var t = state.clock.elapsedTime;
    var s = speed || 0.3;
    var p = phase || 0;

    mesh.current.position.y = (position[1] || 0) + Math.sin(t * s + p) * 0.5;
    mesh.current.scale.setScalar(1 + Math.sin(t * s * 1.8 + p) * 0.04);
    mat.current.opacity = 0.04 + Math.sin(t * s + p) * 0.015;
  });

  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[radius || 2.5, 12, 12]} />
      <meshBasicMaterial
        ref={mat}
        color={color || '#555555'}
        transparent
        opacity={0.04}
        depthWrite={false}
      />
    </mesh>
  );
};

/* ── Floating ring ── */
var FloatingRing = function ({ position, radius, speed, phase }) {
  var mesh = useRef();

  useFrame(function (state) {
    var t = state.clock.elapsedTime;
    var s = speed || 0.18;
    var p = phase || 0;

    mesh.current.rotation.x = t * s * 0.5 + p;
    mesh.current.rotation.z = t * s * 0.3 + p;
    mesh.current.position.y = (position[1] || 0) + Math.sin(t * s + p) * 0.7;
  });

  return (
    <mesh ref={mesh} position={position}>
      <torusGeometry args={[radius || 1.6, 0.018, 6, 52]} />
      <meshBasicMaterial color="#505050" transparent opacity={0.12} depthWrite={false} />
    </mesh>
  );
};

/* ── Camera rig for subtle parallax ── */
var CameraRig = function () {
  var { camera } = useThree();
  var mouse      = useMouse();
  var target     = useRef({ x: 0, y: 0 });

  useFrame(function () {
    target.current.x += (mouse.current.x * 0.6 - target.current.x) * 0.035;
    target.current.y += (mouse.current.y * 0.4 - target.current.y) * 0.035;
    camera.position.x += (target.current.x - camera.position.x) * 0.08;
    camera.position.y += (-target.current.y - camera.position.y) * 0.08;
    camera.lookAt(0, 0, 0);
  });

  return null;
};

/* ══════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════ */
var Background3D = function ({ intensity }) {
  var [isMobile, setIsMobile] = useState(false);

  useEffect(function () {
    var check = function () { setIsMobile(window.innerWidth < 768); };
    check();
    window.addEventListener('resize', check, { passive: true });
    return function () { window.removeEventListener('resize', check); };
  }, []);

  var particleCount = isMobile ? 40 : (intensity === 'low' ? 70 : 120);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        dpr={[1, isMobile ? 1 : 1.5]}
        camera={{ position: [0, 0, 10], fov: 60, near: 0.1, far: 100 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'low-power',
          preserveDrawingBuffer: false,
        }}
        style={{ background: 'transparent' }}
      >
        <CameraRig />

        {/* Particles */}
        <Particles count={particleCount} />

        {/* Animated wireframe grid */}
        {!isMobile && <AnimatedGrid />}

        {/* Ambient orbs — wireframe */}
        <AmbientOrb position={[-5, 1.5, -3]}  radius={2.2} speed={0.22} phase={0}            opacity={0.06} />
        <AmbientOrb position={[5.5, -1, -4]}  radius={1.8} speed={0.28} phase={Math.PI}      opacity={0.05} />
        <AmbientOrb position={[0, 2.5, -6]}   radius={3.0} speed={0.18} phase={Math.PI/2}   opacity={0.04} />

        {/* Glow orbs — solid low opacity */}
        <GlowOrb position={[-4, 0, -5]}   radius={3.5} color="#606060" speed={0.2}  phase={0}       />
        <GlowOrb position={[4.5, 1, -6]}  radius={2.8} color="#505050" speed={0.25} phase={Math.PI} />
        <GlowOrb position={[0, -2, -4]}   radius={2.0} color="#404040" speed={0.3}  phase={1.2}     />

        {/* Floating rings */}
        {!isMobile && (
          <>
            <FloatingRing position={[-6, 0, -5]}  radius={1.4} speed={0.15} phase={0}       />
            <FloatingRing position={[6, 1, -4]}   radius={1.0} speed={0.20} phase={2.1}     />
            <FloatingRing position={[0, -3, -6]}  radius={2.0} speed={0.12} phase={1.0}     />
          </>
        )}
      </Canvas>
    </div>
  );
};

export default Background3D;