import { useRef, useEffect, useState } from 'react'

interface CircularProgressProps {
  progress: number // 0-1
  size: number // px
  strokeWidth: number // px
  color: string // stroke色
  backgroundColor: string // 背景circle色
  children?: React.ReactNode // 中央表示
}

export const CircularProgress = ({
  progress,
  size,
  strokeWidth,
  color,
  backgroundColor,
  children,
}: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(Math.max(progress, 0), 1))
  const center = size / 2

  const prevSizeRef = useRef(size)
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    if (prevSizeRef.current !== size) {
      setAnimate(false)
      prevSizeRef.current = size
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimate(true))
      })
      return () => cancelAnimationFrame(id)
    }
  }, [size])

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* 背景の円 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* プログレスの円 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: animate ? 'stroke-dashoffset 1s linear' : 'none',
          }}
        />
      </svg>
      {/* 中央コンテンツ */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}
