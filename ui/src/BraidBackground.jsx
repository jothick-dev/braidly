import { useEffect, useRef, useState } from 'react'
import { fbm } from './components/noise'

/* ───────────────────── palette ───────────────────── */
const DEFAULT_PALETTE = {
  bg:       [0x04, 0x06, 0x0A],
  green:    { base: 0x2FE58A, core: 0xD9FFEC },
  blue:     { base: 0x2FB8FF, core: 0xDFF8FF },
  dark:     { base: 0x16232A, core: 0x2A3A42 },
  pulse:    0xFFFFFF,
  hud:      'rgba(180,220,255,0.12)',
  hudGlyph: 'rgba(180,220,255,0.18)',
}

/* ───────────────────── phase timing (normalized 0→1) ───────────────────── */
// 0.00–0.15  Source   — knot mid-frame, thin filaments fan out
// 0.15–0.40  Burst   — strings spawn and shoot outward past camera
// 0.40–0.65  Vortex  — curl into slow rotating spiral
// 0.65–0.90  Braid   — consolidate into thick horizontal cable, energy pulses
// 0.90–1.00  Fade    — crossfade back to Source
const PHASE = { SRC: 0, BURST: 0.15, VORTEX: 0.40, BRAID: 0.65, FADE: 0.90 }

function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2 }
function easeOut(t)    { return 1 - Math.pow(1-t,3) }
function clamp01(t)    { return Math.max(0, Math.min(1, t)) }
function lerp(a,b,t)   { return a + (b - a) * t }

function phaseBlend(t, a, b) {
  // returns 0 when t <= a, 1 when t >= b, smooth blend between
  return clamp01((t - a) / (b - a))
}

/* ───────────────────── color helpers ───────────────────── */
function hexToRGB(h) {
  return { r: ((h >> 16) & 0xFF) / 255, g: ((h >> 8) & 0xFF) / 255, b: (h & 0xFF) / 255 }
}
function lerpColor(a, b, t) {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) }
}

/* ═══════════════════════════════════════════════════════════════════════════
   BraidBackground — full-viewport Three.js hero animation
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BraidBackground({
  strandCount = 26,
  palette = DEFAULT_PALETTE,
  speed = 1,
  onReveal,
}) {
  const containerRef = useRef(null)
  const reducedRef = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
  const onRevealRef = useRef(onReveal)
  const firedRef = useRef(false)

  useEffect(() => { onRevealRef.current = onReveal }, [onReveal])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const reduced = reducedRef.current
    let disposed = false

    // ── dynamic imports (Three.js + post-processing) ──────────────────────
    Promise.all([
      import('three'),
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('three/examples/jsm/postprocessing/ShaderPass.js'),
      import('three/examples/jsm/shaders/CopyShader.js'),
    ]).then(([
      THREE,
      { EffectComposer },
      { RenderPass },
      { UnrealBloomPass },
      { ShaderPass },
      { CopyShader },
    ]) => {
      if (disposed) return

      /* ─── scene, camera, renderer ──────────────────────────── */
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(
        palette.bg[0] / 255, palette.bg[1] / 255, palette.bg[2] / 255
      )

      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500)
      camera.position.set(0, 0, 30)
      camera.lookAt(0, 0, 0)

      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      renderer.setPixelRatio(dpr)
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.0
      container.appendChild(renderer.domElement)

      /* ─── bloom post-processing ────────────────────────────── */
      const composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,   // strength
        0.4,   // radius
        0.2    // threshold
      )
      composer.addPass(bloom)

      /* ─── ambient light ────────────────────────────────────── */
      scene.add(new THREE.AmbientLight(0xffffff, 0.3))

      /* ═══════════════════════════════════════════════════════════
         STRANDS — each is a CatmullRomCurve3 → TubeGeometry mesh
         ═══════════════════════════════════════════════════════════ */
      const STRAND_COLORS = [
        palette.green, palette.green, palette.green,
        palette.blue,  palette.blue,  palette.blue,
        palette.dark,  palette.dark,  palette.dark,
      ]
      const NUM_CONTROL_PTS = 50
      const TUBULAR_SEGMENTS = 40
      const RADIAL_SEGMENTS = 6

      const strands = []
      for (let i = 0; i < strandCount; i++) {
        const colorSet = STRAND_COLORS[i % STRAND_COLORS.length]
        const isCore = i % 9 < 3           // green group gets brighter core
        const seed = i * 1.7 + 0.3
        const baseRadius = isCore ? 0.06 : 0.04

        // Base control points along the X axis, spread in Y/Z
        const basePoints = []
        for (let j = 0; j < NUM_CONTROL_PTS; j++) {
          const t = (j / (NUM_CONTROL_PTS - 1)) * 2 - 1  // -1 to 1
          basePoints.push(new THREE.Vector3(
            t * 18,                               // spread along X
            (Math.random() - 0.5) * 4,            // initial Y spread
            (Math.random() - 0.5) * 4,            // initial Z spread
          ))
        }

        const curve = new THREE.CatmullRomCurve3(basePoints)
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(colorSet.base),
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, TUBULAR_SEGMENTS, baseRadius, RADIAL_SEGMENTS, false),
          mat
        )
        scene.add(tube)
        strands.push({
          tube, mat, basePoints, seed, baseRadius,
          currentPoints: basePoints.map(p => p.clone()),
          pulse: { active: false, t: 0, speed: 0.8 + Math.random() * 0.4 },
        })
      }

      /* ═══════════════════════════════════════════════════════════
         PARTICLES — small instanced boxes for bokeh atmosphere
         ═══════════════════════════════════════════════════════════ */
      const PARTICLE_COUNT = reduced ? 40 : 120
      const pGeo = new THREE.BoxGeometry(0.15, 0.06, 0.06)
      const pMat = new THREE.MeshBasicMaterial({
        color: 0x8899AA,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const particles = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_COUNT)
      scene.add(particles)

      const pData = []
      const dummy = new THREE.Object3D()
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2
        const radius = 5 + Math.random() * 30
        pData.push({
          x: Math.cos(angle) * radius,
          y: (Math.random() - 0.5) * 20,
          z: (Math.random() - 0.5) * 30 - 5,
          rotSpeed: (Math.random() - 0.5) * 0.3,
          driftSpeed: 0.1 + Math.random() * 0.2,
          phase: Math.random() * Math.PI * 2,
        })
      }

      /* ═══════════════════════════════════════════════════════════
         CAMERA CONTROLLER — follows the 4-phase choreography
         ═══════════════════════════════════════════════════════════ */
      const camState = {
        pos: new THREE.Vector3(0, 0, 30),
        look: new THREE.Vector3(0, 0, 0),
      }

      function updateCamera(pt, dt) {
        if (reduced) { camera.position.set(0, 0, 30); camera.lookAt(0,0,0); return }

        // Source: near-static, slow drift
        if (pt < PHASE.BURST) {
          const blend = pt / PHASE.BURST
          camState.pos.set(
            lerp(0, 0, blend),
            lerp(0, 0.5, blend),
            lerp(30, 25, blend)
          )
          camState.look.set(0, 0, 0)
        }
        // Burst: camera pulls back slightly, strings fly past
        else if (pt < PHASE.VORTEX) {
          const blend = (pt - PHASE.BURST) / (PHASE.VORTEX - PHASE.BURST)
          camState.pos.set(
            0,
            lerp(0.5, 2, easeInOut(blend)),
            lerp(25, 35, easeOut(blend))
          )
          camState.look.set(0, 0, 0)
        }
        // Vortex: slow push-in toward center
        else if (pt < PHASE.BRAID) {
          const blend = (pt - PHASE.VORTEX) / (PHASE.BRAID - PHASE.VORTEX)
          camState.pos.set(
            lerp(0, -2, blend),
            lerp(2, 0, blend),
            lerp(35, 18, easeInOut(blend))
          )
          camState.look.set(0, 0, 0)
        }
        // Braid: close-up, slight lateral drift
        else if (pt < PHASE.FADE) {
          const blend = (pt - PHASE.BRAID) / (PHASE.FADE - PHASE.BRAID)
          camState.pos.set(
            lerp(-2, 0, blend),
            0,
            lerp(18, 22, blend)
          )
          camState.look.set(0, 0, 0)
        }
        // Fade: transition back
        else {
          const blend = (pt - PHASE.FADE) / (1 - PHASE.FADE)
          camState.pos.set(
            0,
            lerp(0, 0, blend),
            lerp(22, 30, easeInOut(blend))
          )
          camState.look.set(0, 0, 0)
        }

        // Smooth follow
        const smoothFactor = 1 - Math.pow(0.001, dt)
        camera.position.lerp(camState.pos, smoothFactor)
        const lookTarget = new THREE.Vector3().copy(camState.look)
        const currentLook = new THREE.Vector3()
        camera.getWorldDirection(currentLook).multiplyScalar(10).add(camera.position)
        currentLook.lerp(lookTarget, smoothFactor)
        camera.lookAt(currentLook)
      }

      /* ═══════════════════════════════════════════════════════════
         STRAND UPDATE — drives noise-based motion per phase
         ═══════════════════════════════════════════════════════════ */
      function updateStrands(pt, time) {
        strands.forEach((s, si) => {
          const seed = s.seed
          const freq = 0.15
          const noiseAmp = 2.5

          for (let j = 0; j < NUM_CONTROL_PTS; j++) {
            const jNorm = j / (NUM_CONTROL_PTS - 1)  // 0→1 along strand
            const bp = s.basePoints[j]

            // Noise displacement
            const nx = fbm(j * freq, time * 0.3, seed, 3) * noiseAmp
            const ny = fbm(j * freq + 100, time * 0.3, seed + 50, 3) * noiseAmp
            const nz = fbm(j * freq + 200, time * 0.3, seed + 100, 3) * noiseAmp

            let tx = bp.x + nx
            let ty = bp.y + ny
            let tz = bp.z + nz

            // Phase-specific shaping
            if (pt < PHASE.BURST) {
              // Source: strands converge toward center
              const converge = 1 - phaseBlend(pt, 0, PHASE.BURST)
              ty *= converge * 0.3 + 0.7
              tz *= converge * 0.3 + 0.7
            }
            else if (pt < PHASE.VORTEX) {
              // Burst: strands spread outward radially, shot past camera
              const burstProgress = phaseBlend(pt, PHASE.BURST, PHASE.VORTEX)
              const spread = easeOut(burstProgress)
              tx *= 1 + spread * 2
              ty *= 1 + spread * 1.5
              tz *= 1 + spread * 1.5
              // Curved outward path
              const angle = seed * 2.3 + burstProgress * 3
              ty += Math.sin(angle) * spread * 4
              tz += Math.cos(angle) * spread * 4
            }
            else if (pt < PHASE.BRAID) {
              // Vortex: curl into rotating spiral around center
              const vortexProgress = phaseBlend(pt, PHASE.VORTEX, PHASE.BRAID)
              const spiralAngle = jNorm * Math.PI * 4 + time * 0.5 + seed
              const spiralRadius = (1 - vortexProgress) * 3 + 0.5
              tx = lerp(tx, Math.cos(spiralAngle) * spiralRadius, vortexProgress * 0.7)
              ty = lerp(ty, Math.sin(spiralAngle) * spiralRadius, vortexProgress * 0.7)
              tz *= 1 - vortexProgress * 0.5
            }
            else if (pt < PHASE.FADE) {
              // Braid: consolidate into thick horizontal cable
              const braidProgress = phaseBlend(pt, PHASE.BRAID, PHASE.FADE)
              const cableAngle = seed * 2.5 + jNorm * Math.PI * 6
              const cableRadius = 0.3 + (1 - braidProgress) * 0.8
              tx = lerp(tx, jNorm * 20 - 10, braidProgress * 0.8)
              ty = lerp(ty, Math.sin(cableAngle) * cableRadius, braidProgress * 0.9)
              tz = lerp(tz, Math.cos(cableAngle) * cableRadius, braidProgress * 0.9)
            }
            else {
              // Fade: transition back to source shape
              const fadeProgress = phaseBlend(pt, PHASE.FADE, 1)
              tx = lerp(tx, bp.x + nx, fadeProgress * 0.5)
              ty = lerp(ty, bp.y + ny, fadeProgress * 0.5)
              tz = lerp(tz, bp.z + nz, fadeProgress * 0.5)
            }

            s.currentPoints[j].set(tx, ty, tz)
          }

          // Rebuild geometry from updated curve
          const curve = new THREE.CatmullRomCurve3(s.currentPoints)
          const radius = s.baseRadius * (pt > PHASE.BRAID ? 1.8 : 1.0)
          s.tube.geometry.dispose()
          s.tube.geometry = new THREE.TubeGeometry(curve, TUBULAR_SEGMENTS, radius, RADIAL_SEGMENTS, false)

          // Fade opacity per phase
          if (pt < PHASE.BURST) {
            s.mat.opacity = lerp(0.3, 0.7, pt / PHASE.BURST)
          } else if (pt < PHASE.VORTEX) {
            s.mat.opacity = 0.8
          } else if (pt < PHASE.BRAID) {
            s.mat.opacity = 0.9
          } else {
            s.mat.opacity = lerp(0.9, 0.3, (pt - PHASE.BRAID) / (1 - PHASE.BRAID))
          }

          // Energy pulses during braid phase
          if (pt >= PHASE.BRAID && pt < PHASE.FADE && si % 3 === 0) {
            if (!s.pulse.active && Math.random() < 0.005) {
              s.pulse.active = true
              s.pulse.t = 0
            }
            if (s.pulse.active) {
              s.pulse.t += s.pulse.speed * 0.016
              if (s.pulse.t > 1) { s.pulse.active = false; s.mat.color.setHex(STRAND_COLORS[si % STRAND_COLORS.length].base) }
              else {
                // Bright pulse traveling along the tube
                const pulsePos = s.pulse.t
                const intensity = Math.sin(pulsePos * Math.PI)
                s.mat.color.setHex(intensity > 0.7 ? palette.pulse : STRAND_COLORS[si % STRAND_COLORS.length].base)
                s.mat.opacity = 0.9 + intensity * 0.1
              }
            }
          } else {
            s.pulse.active = false
            s.mat.color.setHex(STRAND_COLORS[si % STRAND_COLORS.length].base)
          }
        })
      }

      /* ═══════════════════════════════════════════════════════════
         PARTICLE UPDATE — bokeh drifts, fades by phase
         ═══════════════════════════════════════════════════════════ */
      function updateParticles(time, pt) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const d = pData[i]
          const yOff = Math.sin(time * d.driftSpeed + d.phase) * 0.5
          dummy.position.set(d.x, d.y + yOff, d.z)
          dummy.rotation.set(time * d.rotSpeed, time * d.rotSpeed * 0.7, 0)
          // Particles visible early, fade out during braid
          const visibility = pt < PHASE.BRAID
            ? lerp(0.15, 0.05, pt / PHASE.BRAID)
            : lerp(0.05, 0.12, (pt - PHASE.BRAID) / (1 - PHASE.BRAID))
          dummy.scale.setScalar(visibility * 8)
          dummy.updateMatrix()
          particles.setMatrixAt(i, dummy.matrix)
        }
        particles.instanceMatrix.needsUpdate = true
      }

      /* ═══════════════════════════════════════════════════════════
         RESIZE HANDLER
         ═══════════════════════════════════════════════════════════ */
      function onResize() {
        const w = window.innerWidth, h = window.innerHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
        composer.setSize(w, h)
        bloom.resolution.set(w, h)
      }
      window.addEventListener('resize', onResize)

      /* ═══════════════════════════════════════════════════════════
         ANIMATION LOOP — perpetual cycle driven by progress
         ═══════════════════════════════════════════════════════════ */
      let frameId = 0
      let startTime = performance.now()
      let lastTime = startTime
      const CYCLE_DURATION = 14000 // ms for one full cycle (tweak for pacing)

      function tick(now) {
        if (disposed) return
        const dt = Math.min((now - lastTime) / 1000, 0.1) // cap dt
        lastTime = now
        const elapsed = now - startTime
        const pt = (elapsed % CYCLE_DURATION) / CYCLE_DURATION // normalized 0→1

        if (reduced) {
          // Static fallback: just render one frame, no animation
          renderer.render(scene, camera)
          return
        }

        updateCamera(pt, dt)
        updateStrands(pt, elapsed / 1000)
        updateParticles(elapsed / 1000, pt)
        composer.render()

        frameId = requestAnimationFrame(tick)
      }

      if (reduced) {
        // Static: render once
        renderer.render(scene, camera)
        if (!firedRef.current) { firedRef.current = true; onRevealRef.current?.() }
      } else {
        frameId = requestAnimationFrame(tick)
        if (!firedRef.current) { firedRef.current = true; onRevealRef.current?.() }
      }

      /* ─── visibility: pause when tab hidden ─────────────────── */
      function onVisibility() {
        if (document.hidden) {
          cancelAnimationFrame(frameId)
        } else {
          lastTime = performance.now()
          if (!reduced) frameId = requestAnimationFrame(tick)
        }
      }
      document.addEventListener('visibilitychange', onVisibility)

      /* ─── cleanup ───────────────────────────────────────────── */
      return () => {
        disposed = true
        cancelAnimationFrame(frameId)
        document.removeEventListener('visibilitychange', onVisibility)
        window.removeEventListener('resize', onResize)
        strands.forEach(s => { s.tube.geometry.dispose(); s.mat.dispose(); scene.remove(s.tube) })
        pGeo.dispose(); pMat.dispose()
        renderer.dispose()
        composer.dispose()
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      }
    }) // end Promise.all

    // Return cleanup for the case where Promise.all hasn't resolved yet
    return () => { disposed = true }
  }, [strandCount, palette, speed])

  /* ─── reduced-motion fallback: static gradient ──────────────── */
  if (reducedRef.current) {
    return (
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 40% 50%, rgba(47,229,138,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 60% 45%, rgba(47,184,255,0.06) 0%, transparent 60%),
            linear-gradient(135deg, #04060A 0%, #070C12 100%)
          `,
        }}
        aria-hidden="true"
      />
    )
  }

  return (
    <>
      {/* Three.js canvas — fills viewport, sits behind all content */}
      <div
        ref={containerRef}
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ zIndex: -10 }}
        aria-hidden="true"
      />
      {/* Text-contrast scrim — dark gradient ensures hero text stays readable */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: -5,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 45%, rgba(4,6,10,0.88) 0%, rgba(4,6,10,0.5) 50%, rgba(4,6,10,0.15) 85%, transparent 100%),
            linear-gradient(to top, rgba(4,6,10,0.7) 0%, transparent 40%)
          `,
        }}
        aria-hidden="true"
      />
      {/* HUD overlay — faint schematic grid + data text, phase 4 */}
      <HUDOverlay />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   HUDOverlay — faint CSS grid + monospace glyphs, purely atmospheric
   ═══════════════════════════════════════════════════════════════════════════ */
function HUDOverlay() {
  const lines = []
  // Horizontal grid lines
  for (let i = 0; i < 8; i++) {
    lines.push(
      <div
        key={`h${i}`}
        className="absolute left-0 right-0"
        style={{
          top: `${12 + i * 11}%`,
          height: '1px',
          background: 'rgba(180,220,255,0.04)',
        }}
      />
    )
  }
  // Vertical grid lines
  for (let i = 0; i < 12; i++) {
    lines.push(
      <div
        key={`v${i}`}
        className="absolute top-0 bottom-0"
        style={{
          left: `${8 + i * 8}%`,
          width: '1px',
          background: 'rgba(180,220,255,0.03)',
        }}
      />
    )
  }
  // Fake data glyphs
  const glyphs = [
    { top: '15%', left: '12%', text: 'SYS::INIT' },
    { top: '22%', right: '8%', text: 'BRAID v0.1' },
    { top: '78%', left: '15%', text: 'STRANDS: 26' },
    { top: '85%', right: '12%', text: 'NODE::ACTIVE' },
    { top: '45%', left: '5%', text: 'SYNC' },
    { top: '55%', right: '5%', text: 'LINK' },
  ]

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -3 }} aria-hidden="true">
      {lines}
      {glyphs.map((g, i) => (
        <span
          key={i}
          className="absolute font-mono select-none"
          style={{
            ...g,
            fontSize: '9px',
            letterSpacing: '0.12em',
            color: 'rgba(180,220,255,0.10)',
            textTransform: 'uppercase',
          }}
        >
          {g.text}
        </span>
      ))}
    </div>
  )
}
