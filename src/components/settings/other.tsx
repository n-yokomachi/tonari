import { useTranslation } from 'react-i18next'
import Image from 'next/image'

import AdvancedSettings from './advancedSettings'

const Other = () => {
  const { t } = useTranslation()

  return (
    <>
      <div className="flex items-center mb-6">
        <Image
          src="/images/setting-icons/other-settings.svg"
          alt="Other Settings"
          width={24}
          height={24}
          className="mr-2"
        />
        <h2 className="text-2xl font-bold">{t('OtherSettings')}</h2>
      </div>

      <AdvancedSettings />
    </>
  )
}
export default Other
