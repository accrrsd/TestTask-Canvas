import { useEffect, useRef, useState } from 'react'
import './App.css'
// constants (settings)
const MAX_PARTICLES = 120

const MAX_PARTICLE_SIZE = 15
const MIN_PARTICLE_SIZE = 5
const MOUSE_COLLISION_RADIUS = 10

const PARTICLE_COLLISION_VELOCITY = 0.005
const PARTICLE_VELOCITY_LEAK_MODIFIER = 0.002

type TMouseCords = {
  x: number
  y: number
}

type TCanvasMode = 'collision' | 'edit'

class Particle {
  public x: number = 0
  public y: number = 0
  public size: number = 0
  private dirX: number = 0
  private dirY: number = 0

  constructor(public color: string, private canvas: HTMLCanvasElement, private ctx: CanvasRenderingContext2D) {
    if (!canvas || !ctx) return
    this.x = Math.random() * canvas.width
    this.y = Math.random() * canvas.height
    this.size = Math.floor(Math.random() * (MAX_PARTICLE_SIZE - MIN_PARTICLE_SIZE + 1) + MIN_PARTICLE_SIZE)
    this.dirX = 0
    this.dirY = 0
  }

  public draw() {
    if (!this.canvas || !this.ctx) return
    this.ctx.beginPath()
    this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    this.ctx.closePath()
    this.ctx.fillStyle = this.color
    this.ctx.fill()
  }

  private collideWithRadius(cords: { x: number; y: number }, collisionRadius: number) {
    const distanceX = cords.x - this.x
    const distanceY = cords.y - this.y
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)
    // collision with mouse will increase velocity
    if (distance < collisionRadius + this.size) {
      if (this.x < cords.x) {
        this.dirX += -PARTICLE_COLLISION_VELOCITY
      }
      if (this.x > cords.x) {
        this.dirX += PARTICLE_COLLISION_VELOCITY
      }
      if (this.y < cords.y) {
        this.dirY += -PARTICLE_COLLISION_VELOCITY
      }
      if (this.y > cords.y) {
        this.dirY += PARTICLE_COLLISION_VELOCITY
      }
    }
  }

  public move(mousePos: TMouseCords, particlesArr: Particle[], mode: TCanvasMode, velocity_leak: boolean) {
    if (!this.canvas || !this.ctx) return

    // collision with mouse
    if (mode === 'collision') this.collideWithRadius(mousePos, MOUSE_COLLISION_RADIUS)

    // collision with other particles
    for (let i = 0; i < particlesArr.length; i++) {
      const p1 = particlesArr[i]
      if (this === p1) continue
      this.collideWithRadius(p1, p1.size)
    }

    // bouncing out of border
    if (this.x + this.size >= this.canvas.width || this.x - this.size <= 0) {
      this.dirX *= -0.5
      this.dirY *= 0.5
      // prevent endless bouncing
      this.x = Math.min(Math.max(this.size, this.x), this.canvas.width - this.size)
    }
    if (this.y + this.size >= this.canvas.height || this.y - this.size <= 0) {
      this.dirY *= -0.5
      this.dirX *= 0.5
      this.y = Math.min(Math.max(this.size, this.y), this.canvas.height - this.size)
    }

    // main movement
    this.x += this.dirX
    this.y += this.dirY

    // velocity leak
    if (velocity_leak) {
      this.dirX -= this.dirX * PARTICLE_VELOCITY_LEAK_MODIFIER
      this.dirY -= this.dirY * PARTICLE_VELOCITY_LEAK_MODIFIER
    }
  }
}

function App() {
  const modeRef = useRef<TCanvasMode>('collision')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mousePosRef = useRef({ x: 0, y: 0 })
  const velocityLeakRef = useRef(false)
  const [activeParticle, setActiveParticle] = useState<Particle | null>(null)
  const [_, rerender] = useState({})

  const drawMouseBorder = (ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number): void => {
    ctx.beginPath()
    ctx.arc(mouseX, mouseY, MOUSE_COLLISION_RADIUS, 0, Math.PI * 2)
    ctx.closePath()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'yellow'
    ctx.stroke()
  }

  const findParticleWithCords = (x: number, y: number): Particle | undefined =>
    particlesRef.current.find((p) => p.x - p.size <= x && p.x + p.size >= x && p.y - p.size <= y && p.y + p.size >= y)

  const convertCordsToCanvasCords = (x: number, y: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: x - rect.left, y: y - rect.top }
  }

  // canvas settings and event handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const updateCanvasSize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    updateCanvasSize()

    const handleMouseClickOverParticle = (e: MouseEvent) => {
      if (modeRef.current !== 'edit') return
      const boundingMouse = convertCordsToCanvasCords(e.clientX, e.clientY)
      const particle = findParticleWithCords(boundingMouse.x, boundingMouse.y)
      if (!particle) return
      setActiveParticle(particle)
    }

    const handleMouseMove = (e: MouseEvent) => (mousePosRef.current = { x: e.clientX, y: e.clientY })

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('click', handleMouseClickOverParticle)
    window.addEventListener('resize', updateCanvasSize)

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('click', handleMouseClickOverParticle)
      window.removeEventListener('resize', updateCanvasSize)
    }
  }, [canvasRef])

  // create particles
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || particlesRef.current.length > MAX_PARTICLES) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const randomHexColor = () => `#${Math.floor(Math.random() * 16777215).toString(16)}`
    const particles = new Array(MAX_PARTICLES).fill(undefined).map(() => new Particle(randomHexColor(), canvas, ctx))
    particlesRef.current = particles
  }, [canvasRef])

  // start animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const animate = () => {
      const boundingMouse = convertCordsToCanvasCords(mousePosRef.current.x, mousePosRef.current.y)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current.forEach((particle) => {
        particle.move({ x: boundingMouse.x, y: boundingMouse.y }, particlesRef.current, modeRef.current, velocityLeakRef.current)
        particle.draw()
      })
      if (modeRef.current === 'collision') drawMouseBorder(ctx, boundingMouse.x, boundingMouse.y)
      requestAnimationFrame(animate)
    }
    animate()
  }, [canvasRef, particlesRef, modeRef, velocityLeakRef])

  return (
    <div className="App">
      <h1 className="title">Тестовое задание с шариками</h1>
      <div className="board">
        <canvas id={'canvas'} ref={canvasRef} className="canvas"></canvas>
      </div>
      <div className="buttonsWrapper">
        <button className="button" onClick={() => (modeRef.current = 'collision')}>
          Режим коллизии
        </button>
        <button className="button" onClick={() => (modeRef.current = 'edit')}>
          Режим редактирования
        </button>
        <div className="checkboxWrapper">
          <p>Включить затухание скорости</p>
          <input type="checkbox" onClick={() => (velocityLeakRef.current = !velocityLeakRef.current)} className="checkbox"></input>
        </div>
      </div>
      {activeParticle && (
        <div className="particleSettings">
          <div className="inputWrapper">
            <p>Цвет</p>
            <input type="color" value={activeParticle.color} onChange={(e) => (activeParticle.color = e.target.value)} />
          </div>
          <div className="inputWrapper">
            <p>Размер</p>
            <input
              type="number"
              min={MIN_PARTICLE_SIZE}
              max={MAX_PARTICLE_SIZE}
              value={activeParticle.size}
              onChange={(e) => {
                activeParticle.size = Number(e.target.value)
                rerender({})
              }}
            />
          </div>
          <div className="inputWrapper">
            <p>X</p>
            <input
              type="number"
              max={canvasRef.current?.width}
              min={0}
              value={activeParticle.x}
              onChange={(e) => {
                activeParticle.x = Number(e.target.value)
                rerender({})
              }}
            />
          </div>
          <div className="inputWrapper">
            <p>Y</p>
            <input
              type="number"
              max={canvasRef.current?.height}
              min={0}
              value={activeParticle.y}
              onChange={(e) => {
                activeParticle.y = Number(e.target.value)
                rerender({})
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
export default App
