import { ButtonHTMLAttributes } from 'react'
import Image from 'next/image'

// アイコン名からSVGパスへのマッピング
const iconNameToPath: Record<string, string> = {
  // 24/xxx 形式のアイコン名をSVGファイルパスにマッピング
  '24/Settings': '/images/icons/settings.svg',
  '24/Send': '/images/icons/send.svg',
  '24/Close': '/images/icons/close.svg',
  '24/Add': '/images/icons/add.svg',
  '24/Subtract': '/images/icons/subtract.svg',
  '24/Trash': '/images/icons/trash.svg',
  '24/Play': '/images/icons/play.svg',
  '24/PauseAlt': '/images/icons/pause.svg',
  '24/Video': '/images/icons/video.svg',
  '24/Prev': '/images/icons/prev.svg',
  '24/Next': '/images/icons/next.svg',
  '24/Expand': '/images/icons/expand.svg',
  '24/Shutter': '/images/icons/shutter.svg',
  '24/FrameEffect': '/images/icons/frame-effect.svg',
  '24/Check': '/images/icons/check.svg',
  '24/Info': '/images/icons/info.svg',
  '24/Error': '/images/icons/error.svg',
  '24/Dot': '/images/icons/dot.svg',
  '24/Camera': '/images/icons/camera.svg',
  '24/AddImage': '/images/icons/add.svg',
  // カスタムアイコン
  'screen-share': '/images/icons/screen-share.svg',
  stop: '/images/icons/stop.svg',
  '24/Database': '/images/icons/database.svg',
}

type IconName = keyof typeof iconNameToPath | string

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  iconName: IconName
  isProcessing: boolean
  isProcessingIcon?: IconName
  label?: string
  iconColor?: string
  backgroundColor?: string
  'aria-label'?: string
}

export const IconButton = ({
  iconName,
  isProcessing,
  isProcessingIcon,
  label,
  iconColor,
  backgroundColor = 'bg-primary hover:bg-primary-hover active:bg-primary-press disabled:bg-primary-disabled',
  'aria-label': ariaLabel,
  ...rest
}: Props) => {
  const getIconPath = (name: IconName): string => {
    return iconNameToPath[name] || '/images/icons/dot.svg'
  }

  const currentIcon = isProcessing
    ? getIconPath(isProcessingIcon || '24/Dot')
    : getIconPath(iconName)

  return (
    <button
      {...rest}
      aria-label={ariaLabel || label}
      className={`${backgroundColor} rounded-2xl text-sm p-2 text-center inline-flex items-center focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 transition-all duration-200
        ${iconColor || 'text-theme'}
        ${rest.className}
      `}
    >
      <Image
        src={currentIcon}
        alt={ariaLabel || label || iconName}
        width={24}
        height={24}
        className={isProcessing ? 'animate-pulse' : ''}
      />
      {label && <div className="mx-2 font-bold">{label}</div>}
    </button>
  )
}
