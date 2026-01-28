import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  onResize: (width: number) => void
  minWidth: number
  maxWidth: number
  initialWidth: number
}

export const ResizableDivider = ({
  onResize,
  minWidth,
  maxWidth,
  initialWidth,
}: Props) => {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(initialWidth)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      startXRef.current = e.clientX
      startWidthRef.current = initialWidth
    },
    [initialWidth]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      const delta = e.clientX - startXRef.current
      const newWidth = Math.min(
        maxWidth,
        Math.max(minWidth, startWidthRef.current + delta)
      )
      onResize(newWidth)
    },
    [isDragging, minWidth, maxWidth, onResize]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div
      className={`w-2 cursor-col-resize flex items-center justify-center group hover:bg-secondary/20 transition-colors ${
        isDragging ? 'bg-secondary/30' : ''
      }`}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`w-1 h-16 rounded-full transition-colors ${
          isDragging
            ? 'bg-secondary'
            : 'bg-gray-300 group-hover:bg-secondary/60'
        }`}
      />
    </div>
  )
}
