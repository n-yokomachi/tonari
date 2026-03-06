'use client'
import React, { memo } from 'react'
import { LiquidMetal as LiquidMetalShader } from '@paper-design/shaders-react'

export interface LiquidMetalProps {
  colorBack?: string
  colorTint?: string
  speed?: number
  repetition?: number
  distortion?: number
  scale?: number
  shiftRed?: number
  shiftBlue?: number
  className?: string
  style?: React.CSSProperties
}

export const LiquidMetal = memo(function LiquidMetal({
  colorBack = '#aaaaac',
  colorTint = '#ffffff',
  speed = 0.5,
  repetition = 4,
  distortion = 0.1,
  scale = 1,
  shiftRed = 0.3,
  shiftBlue = -0.3,
  className,
  style,
}: LiquidMetalProps) {
  return (
    <div
      className={`absolute inset-0 z-0 overflow-hidden ${className ?? ''}`}
      style={style}
    >
      <LiquidMetalShader
        colorBack={colorBack}
        colorTint={colorTint}
        speed={speed}
        repetition={repetition}
        distortion={distortion}
        softness={0}
        shiftRed={shiftRed}
        shiftBlue={shiftBlue}
        angle={45}
        shape="none"
        scale={scale}
        fit="cover"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
})

LiquidMetal.displayName = 'LiquidMetal'
