import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Sphere, Cylinder } from '@react-three/drei';
import * as THREE from 'three';

export interface RobotModelHandle {
  setExpression: (exp: 'normal' | 'happy' | 'surprised' | 'dizzy') => void;
  triggerJump: () => void;
  triggerSpin: () => void;
  triggerWiggle: () => void;
}

interface RobotModelProps {
  eyeOffset: { lx: number; ly: number; rx: number; ry: number };
  squish: { sx: number; sy: number; rotate: number };
  grabbed: boolean;
  expression: 'normal' | 'happy' | 'surprised' | 'dizzy';
  randomSpin: number;
  idleBob: number;
}

const RobotModel = forwardRef<RobotModelHandle, RobotModelProps>(
  ({ eyeOffset, squish, grabbed, expression, randomSpin, idleBob }, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const leftWingRef = useRef<THREE.Group>(null);
    const rightWingRef = useRef<THREE.Group>(null);
    const leftEarRef = useRef<THREE.Group>(null);
    const rightEarRef = useRef<THREE.Group>(null);
    const leftEyePupilRef = useRef<THREE.Group>(null);
    const rightEyePupilRef = useRef<THREE.Group>(null);
    const tailRef = useRef<THREE.Group>(null);
    const breathRef = useRef(0);

    // Colors — soft magical palette
    const bodyColor = new THREE.Color('#8b7cf6');
    const bellyColor = new THREE.Color('#c4b5fd');
    const earColor = new THREE.Color('#7c6aeb');
    const earInnerColor = new THREE.Color('#e0d9ff');
    const whiteColor = new THREE.Color('#ffffff');
    const pupilColor = new THREE.Color('#2d1f6e');
    const blushColor = new THREE.Color('#f472b6');
    const wingColor = new THREE.Color('#c4b5fd');
    const glowColor = new THREE.Color('#a78bfa');

    useImperativeHandle(ref, () => ({
      setExpression: () => {},
      triggerJump: () => {},
      triggerSpin: () => {},
      triggerWiggle: () => {},
    }));

    useFrame((_, delta) => {
      if (!groupRef.current) return;

      // Idle float
      groupRef.current.position.y = idleBob * 0.12;

      // Rotation from squish
      groupRef.current.rotation.z = THREE.MathUtils.degToRad(squish.rotate);

      // Spin
      if (randomSpin) {
        groupRef.current.rotation.y += THREE.MathUtils.degToRad(randomSpin * delta * 2);
      }

      // Ear wiggle
      if (leftEarRef.current && rightEarRef.current && !grabbed) {
        const earWiggle = Math.sin(Date.now() * 0.006) * 0.08;
        leftEarRef.current.rotation.z = -0.15 + earWiggle;
        rightEarRef.current.rotation.z = 0.15 - earWiggle;
      }

      // Wing flutter
      if (leftWingRef.current && rightWingRef.current) {
        const flutterSpeed = grabbed ? 0.05 : 0.02;
        const flutterAmp = grabbed ? 0.6 : 0.2;
        const flutter = Math.sin(Date.now() * flutterSpeed) * flutterAmp;
        leftWingRef.current.rotation.y = -0.3 + flutter;
        rightWingRef.current.rotation.y = 0.3 - flutter;
        leftWingRef.current.rotation.z = flutter * 0.5;
        rightWingRef.current.rotation.z = -flutter * 0.5;
      }

      // Eye tracking
      if (leftEyePupilRef.current) {
        leftEyePupilRef.current.position.x = eyeOffset.lx * 0.04;
        leftEyePupilRef.current.position.y = eyeOffset.ly * 0.04;
      }
      if (rightEyePupilRef.current) {
        rightEyePupilRef.current.position.x = eyeOffset.rx * 0.04;
        rightEyePupilRef.current.position.y = eyeOffset.ry * 0.04;
      }

      // Tail wagging — energy depends on expression
      if (tailRef.current) {
        const wagSpeed = expression === 'happy' ? 0.012 : expression === 'surprised' ? 0.02 : 0.007;
        const wagAmp = expression === 'happy' ? 0.35 : expression === 'surprised' ? 0.5 : 0.2;
        if (grabbed) {
          tailRef.current.rotation.z = Math.sin(Date.now() * 0.018) * 0.55;
        } else {
          tailRef.current.rotation.z = Math.sin(Date.now() * wagSpeed) * wagAmp;
        }
      }

      // Subtle breathing (idle) or squish-only (grabbed)
      breathRef.current += delta;
      const breathe = 1 + Math.sin(breathRef.current * 1.8) * 0.03;
      if (grabbed) {
        groupRef.current.scale.set(squish.sx, squish.sy, 1);
      } else {
        groupRef.current.scale.set(squish.sx * breathe, squish.sy * breathe, breathe);
      }
    });

    // Expression-driven values
    const mouthOpen = expression === 'surprised' ? 0.07 : expression === 'happy' ? 0.06 : 0.025;
    const mouthW = expression === 'happy' ? 0.18 : expression === 'surprised' ? 0.09 : 0.14;
    const eyeScaleY = expression === 'happy' ? 0.7 : expression === 'surprised' ? 1.3 : 1;
    const blushOpacity = expression === 'happy' ? 0.6 : 0.25;

    return (
      <group ref={groupRef}>
        {/* ── Wings (behind body) ── */}
        <group ref={leftWingRef} position={[-0.3, 0.0, -0.05]}>
          <mesh rotation={[0.1, -0.5, 0.2]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial
              color={wingColor}
              roughness={0.4}
              metalness={0.05}
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
        <group ref={rightWingRef} position={[0.3, 0.0, -0.05]}>
          <mesh rotation={[0.1, 0.5, -0.2]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial
              color={wingColor}
              roughness={0.4}
              metalness={0.05}
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        {/* ── Ears ── */}
        <group ref={leftEarRef} position={[-0.16, 0.42, -0.05]} rotation={[0, 0, -0.15]}>
          <Cylinder args={[0.04, 0.09, 0.35, 8]} position={[0, 0.08, 0]}>
            <meshStandardMaterial color={earColor} roughness={0.3} metalness={0.1} />
          </Cylinder>
          <Cylinder args={[0.02, 0.05, 0.22, 8]} position={[0, 0.06, 0.02]}>
            <meshStandardMaterial color={earInnerColor} roughness={0.3} metalness={0.05} />
          </Cylinder>
        </group>
        <group ref={rightEarRef} position={[0.16, 0.42, -0.05]} rotation={[0, 0, 0.15]}>
          <Cylinder args={[0.04, 0.09, 0.35, 8]} position={[0, 0.08, 0]}>
            <meshStandardMaterial color={earColor} roughness={0.3} metalness={0.1} />
          </Cylinder>
          <Cylinder args={[0.02, 0.05, 0.22, 8]} position={[0, 0.06, 0.02]}>
            <meshStandardMaterial color={earInnerColor} roughness={0.3} metalness={0.05} />
          </Cylinder>
        </group>

        {/* ── Body (squished sphere) ── */}
        <Sphere args={[0.48, 32, 24]} scale={[1, 0.82, 0.85]}>
          <meshStandardMaterial
            color={bodyColor}
            roughness={0.25}
            metalness={0.08}
          />
        </Sphere>

        {/* Belly patch */}
        <Sphere args={[0.3, 16, 16]} position={[0, -0.08, 0.2]} scale={[1, 0.8, 0.4]}>
          <meshStandardMaterial
            color={bellyColor}
            roughness={0.3}
            metalness={0.05}
          />
        </Sphere>

        {/* ── Eyes ── */}
        {/* Left eye white */}
        <group position={[-0.12, 0.06, 0.35]}>
          <Sphere args={[0.12, 16, 16]} scale={[1, eyeScaleY, 1]}>
            <meshStandardMaterial color={whiteColor} roughness={0.08} />
          </Sphere>
          {/* Pupil */}
          <group ref={leftEyePupilRef} position={[0, 0, 0.08]}>
            <Sphere args={[0.07, 12, 12]}>
              <meshStandardMaterial color={pupilColor} roughness={0.05} />
            </Sphere>
            {/* Catchlight */}
            <Sphere args={[0.025, 8, 8]} position={[0.02, 0.025, 0.06]}>
              <meshStandardMaterial color={whiteColor} roughness={0.05} emissive={whiteColor} emissiveIntensity={0.4} />
            </Sphere>
          </group>
        </group>

        {/* Right eye white */}
        <group position={[0.12, 0.06, 0.35]}>
          <Sphere args={[0.12, 16, 16]} scale={[1, eyeScaleY, 1]}>
            <meshStandardMaterial color={whiteColor} roughness={0.08} />
          </Sphere>
          {/* Pupil */}
          <group ref={rightEyePupilRef} position={[0, 0, 0.08]}>
            <Sphere args={[0.07, 12, 12]}>
              <meshStandardMaterial color={pupilColor} roughness={0.05} />
            </Sphere>
            {/* Catchlight */}
            <Sphere args={[0.025, 8, 8]} position={[0.02, 0.025, 0.06]}>
              <meshStandardMaterial color={whiteColor} roughness={0.05} emissive={whiteColor} emissiveIntensity={0.4} />
            </Sphere>
          </group>
        </group>

        {/* ── Blush ── */}
        <Sphere args={[0.05, 8, 8]} position={[-0.24, -0.08, 0.32]}>
          <meshStandardMaterial color={blushColor} roughness={0.6} transparent opacity={blushOpacity} />
        </Sphere>
        <Sphere args={[0.05, 8, 8]} position={[0.24, -0.08, 0.32]}>
          <meshStandardMaterial color={blushColor} roughness={0.6} transparent opacity={blushOpacity} />
        </Sphere>

        {/* ── Mouth ── */}
        <mesh position={[0, -0.1, 0.36]}>
          <planeGeometry args={[mouthW, mouthOpen]} />
          <meshStandardMaterial
            color={pupilColor}
            roughness={0.3}
            transparent
            opacity={expression === 'dizzy' ? 0.3 : 0.6}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* ── Tail (waggy) ── */}
        <group ref={tailRef} position={[0, -0.35, -0.25]}>
          <mesh rotation={[0.3, 0, 0]} position={[0, -0.06, 0]}>
            <coneGeometry args={[0.04, 0.16, 8, 8]} />
            <meshStandardMaterial color={bodyColor} roughness={0.25} metalness={0.08} />
          </mesh>
          {/* Tail tip fluff */}
          <Sphere args={[0.05, 8, 8]} position={[0, -0.12, 0.06]} rotation={[0.3, 0, 0]}>
            <meshStandardMaterial color={bellyColor} roughness={0.3} metalness={0.05} />
          </Sphere>
        </group>

        {/* ── Bottom glow ring ── */}
        <mesh position={[0, -0.44, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.45, 32]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={grabbed ? 0.35 : 0.15}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* ── Sparkle particles around body ── */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
          const rad = THREE.MathUtils.degToRad(angle);
          const rx = Math.cos(rad) * 0.5;
          const ry = Math.sin(rad) * 0.38 * 0.82;
          return (
            <Sphere
              key={i}
              args={[0.02, 4, 4]}
              position={[rx, ry, 0.1]}
            >
              <meshBasicMaterial
                color={glowColor}
                transparent
                opacity={0.2 + Math.random() * 0.3}
              />
            </Sphere>
          );
        })}
      </group>
    );
  }
);

RobotModel.displayName = 'RobotModel';
export default RobotModel;
